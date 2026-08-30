import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createFakeDb } from "./helpers/fake-db.js";
import { listBroadcastRecipients, countBroadcastRecipients, recipientType } from "../database/recipients.js";

const schema = await readFile("database/schema.sql", "utf8");

function makeDb() {
  return createFakeDb({
    users: [
      { telegram_id: "1", username: "alice", first_name: "Alice", reminder_enabled: 1, last_seen: "2026-08-29 10:00:00" },
      { telegram_id: "2", username: "bob", first_name: "Bob", reminder_enabled: 0, last_seen: "2026-08-01 10:00:00" },
      { telegram_id: "3", username: null, first_name: "Carol", reminder_enabled: 1, last_seen: "2026-08-28 09:00:00" },
      { telegram_id: "4", username: "dave", first_name: "Dave", reminder_enabled: 1, last_seen: null },
    ],
    groups: [
      { id: "-100111", title: "Bots", reminder_enabled: 0, last_seen: "2026-08-29 08:00:00" },
      { id: "-100222", title: "Active Group", reminder_enabled: 1, last_seen: "2026-08-29 07:00:00" },
      { id: "-100333", title: "Old Group", reminder_enabled: 1, last_seen: "2026-08-01 07:00:00" },
    ],
  });
}

// Extract real column names per table from schema.sql (no assumptions).
function schemaColumns(table) {
  const block = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\);`, "i"))?.[1] || "";
  return [...block.matchAll(/^\s*([a-z_]+)\s+(?:TEXT|INTEGER|DATETIME)/gim)].map((m) => m[1].toLowerCase());
}

async function runList(db, type, filter) {
  await listBroadcastRecipients(db, type, filter, { offset: 0, limit: 50 });
  const sqls = db.sqlLog.filter((s) => new RegExp(`from ${type}\\b`, "i").test(s) && !/count\(\*\)/i.test(s));
  assert.ok(sqls.length > 0, `expected a query for ${type}`);
  return sqls;
}

// ---------- Filter semantics ----------

test("users filters: all / on / off / active / inactive", async () => {
  const db = makeDb();
  assert.equal(await countBroadcastRecipients(db, "users", "all"), 4);
  assert.equal(await countBroadcastRecipients(db, "users", "on"), 3);
  assert.equal(await countBroadcastRecipients(db, "users", "off"), 1);
  assert.equal(await countBroadcastRecipients(db, "users", "active"), 2);
  assert.equal(await countBroadcastRecipients(db, "users", "inactive"), 2);

  const off = await listBroadcastRecipients(db, "users", "off", { offset: 0, limit: 50 });
  assert.deepEqual(off.map((r) => r.id), ["2"]);
});

test("groups filters: Reminder OFF returns disabled groups (production bug regression)", async () => {
  const db = makeDb();
  const off = await listBroadcastRecipients(db, "groups", "off", { offset: 0, limit: 50 });
  assert.equal(off.length, 1);
  assert.equal(off[0].id, "-100111");
  assert.equal(off[0].displayName, "Bots");
  assert.equal(off[0].reminderEnabled, false);
  assert.equal(off[0].type, "groups");
  assert.equal(off[0].username, null); // groups have no username — null, never a SQL column
});

test("groups filters: Inactive executes without a SQL error", async () => {
  const db = makeDb();
  const inactive = await listBroadcastRecipients(db, "groups", "inactive", { offset: 0, limit: 50 });
  assert.ok(Array.isArray(inactive));
  assert.ok(inactive.every((g) => g.type === "groups" && g.username === null));
});

test("groups filters: all / on / active counts and listing", async () => {
  const db = makeDb();
  assert.equal(await countBroadcastRecipients(db, "groups", "all"), 3);
  assert.equal(await countBroadcastRecipients(db, "groups", "on"), 2);
  assert.equal(await countBroadcastRecipients(db, "groups", "off"), 1);
  assert.ok(Array.isArray(await listBroadcastRecipients(db, "groups", "active", { offset: 0, limit: 50 })));
});

// ---------- SQL regression (the exact production bug) ----------

test("REGRESSION: group recipient SQL never references the username column", async () => {
  const db = makeDb();
  for (const filter of ["all", "on", "off", "active", "inactive"]) {
    const sqls = await runList(db, "groups", filter);
    for (const sql of sqls) {
      assert.ok(!/\busername\b/i.test(sql), `group SQL must not select username: ${sql}`);
    }
  }
});

test("REGRESSION: every recipient SQL column exists in the real schema", async () => {
  const db = makeDb();
  const tableByType = { users: "users", groups: "groups" };
  for (const [type, table] of Object.entries(tableByType)) {
    const allowed = new Set(schemaColumns(table));
    assert.ok(allowed.size > 0, `schema columns for ${table} must parse`);
    for (const filter of ["all", "on", "off", "active", "inactive"]) {
      const sqls = await runList(db, type, filter);
      for (const sql of sqls) {
        const selectPart = sql.match(/select\s+([\s\S]*?)\s+from\s/i)?.[1] || "";
        for (const col of selectPart.split(",").map((c) => c.trim().toLowerCase())) {
          assert.ok(allowed.has(col), `column "${col}" queried for ${table} does not exist in schema (SQL: ${sql})`);
        }
      }
    }
  }
});

test("normalized recipient shape exposes type-safe fields only", async () => {
  const db = makeDb();
  const users = await listBroadcastRecipients(db, "users", "all", { offset: 0, limit: 50 });
  const groups = await listBroadcastRecipients(db, "groups", "all", { offset: 0, limit: 50 });

  for (const r of users) {
    assert.deepEqual(Object.keys(r).sort(), ["displayName", "id", "lastSeen", "reminderEnabled", "type", "username"]);
    assert.equal(r.type, "users");
  }
  for (const g of groups) {
    assert.deepEqual(Object.keys(g).sort(), ["displayName", "id", "lastSeen", "reminderEnabled", "type", "username"]);
    assert.equal(g.type, "groups");
    assert.equal(g.username, null);
  }
});

test("recipientType rejects channels and unknown types for custom broadcast", () => {
  assert.equal(recipientType("channels"), null);
  assert.equal(recipientType("nope"), null);
  assert.ok(recipientType("users"));
  assert.ok(recipientType("groups"));
});


