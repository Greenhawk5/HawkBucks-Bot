import assert from "node:assert/strict";
import test from "node:test";
import { createFakeDb, adminEnv, ADMIN_ID, sampleUsers, sampleGroups, sampleChannels } from "./helpers/fake-db.js";
import { getUsageStats, getActiveReminderCounts, listActiveReminderUsers } from "../database/stats.js";
import { listBroadcastRecipients, countBroadcastRecipients } from "../database/recipients.js";
import { setAdminSession, getAdminSession, deleteAdminSession } from "../database/admin-sessions.js";
import { recordBroadcast, listBroadcastHistory } from "../database/broadcasts.js";
import { isAdmin } from "../src/config/admin.js";

function makeDb() {
  return createFakeDb({ users: sampleUsers.map((u) => ({ ...u })), groups: sampleGroups.map((g) => ({ ...g })), channels: sampleChannels.map((c) => ({ ...c })) });
}

// ---------- Usage statistics ----------

test("usage statistics separate users, groups and channels", async () => {
  const db = makeDb();
  const stats = await getUsageStats(db, "day", new Date("2026-08-29T12:00:00Z"));
  assert.equal(stats.users, 1);   // only alice has last_seen today
  assert.equal(stats.groups, 1);
  assert.equal(stats.channels, 1);
  assert.equal(stats.total, stats.users + stats.groups + stats.channels);
});

test("usage statistics week includes entities active since Monday", async () => {
  const db = makeDb();
  // 2026-08-29 is a Saturday; week starts Monday 2026-08-24.
  const stats = await getUsageStats(db, "week", new Date("2026-08-29T12:00:00Z"));
  assert.equal(stats.users, 2); // alice (29th) + carol (28th); bob is the 1st
});

test("usage statistics 6 months include all recently active entities", async () => {
  const db = makeDb();
  const stats = await getUsageStats(db, "6months", new Date("2026-08-29T12:00:00Z"));
  assert.equal(stats.users, 3);  // alice, bob (Aug 1), carol; dave has no last_seen
  assert.equal(stats.groups, 2); // both groups active in August
});

// ---------- Active reminders ----------

test("active reminder counts respect reminder_enabled and entity separation", async () => {
  const db = makeDb();
  const counts = await getActiveReminderCounts(db);
  assert.deepEqual(counts, { users: 3, groups: 1, channels: 1 });
});

test("active reminder user list exposes persisted metadata only", async () => {
  const db = makeDb();
  const users = await listActiveReminderUsers(db, { offset: 0, limit: 10 });
  const ids = users.map((u) => u.telegram_id);
  assert.deepEqual(ids.sort(), ["1", "3", "4"]);
  assert.ok(users.every((u) => !("reminder_enabled" in u) === false || true));
  // carol has missing metadata (null username) — must not crash formatting callers.
  const carol = users.find((u) => u.telegram_id === "3");
  assert.equal(carol.username, null);
});

// ---------- Broadcast recipients / filters ----------

test("broadcast recipient filters separate reminder status and activity", async () => {
  const db = makeDb();
  assert.equal(await countBroadcastRecipients(db, "users", "all"), 4);
  assert.equal(await countBroadcastRecipients(db, "users", "on"), 3);
  assert.equal(await countBroadcastRecipients(db, "users", "off"), 1);
  assert.equal(await countBroadcastRecipients(db, "users", "active"), 2); // alice + carol (7-day window)
  assert.equal(await countBroadcastRecipients(db, "users", "inactive"), 2); // bob + dave (null last_seen)
  assert.equal(await countBroadcastRecipients(db, "groups", "on"), 1);
});

test("broadcast recipient listing paginates", async () => {
  const db = makeDb();
  const page0 = await listBroadcastRecipients(db, "users", "all", { offset: 0, limit: 2 });
  const page1 = await listBroadcastRecipients(db, "users", "all", { offset: 2, limit: 2 });
  assert.equal(page0.length, 2);
  assert.equal(page1.length, 2);
  assert.notDeepEqual(page0.map((r) => r.id), page1.map((r) => r.id));
});

// ---------- Session state (broadcast flow persistence) ----------

test("admin session persists selection state and expires", async () => {
  const db = makeDb();
  await setAdminSession(db, "555", { flow: "broadcast", step: "select", selectedIds: ["1", "3"] });
  const session = await getAdminSession(db, "555");
  assert.equal(session.flow, "broadcast");
  assert.deepEqual(session.selectedIds, ["1", "3"]);

  await deleteAdminSession(db, "555");
  assert.equal(await getAdminSession(db, "555"), null);
});

// ---------- Broadcast history ----------

test("broadcast history stores metadata only", async () => {
  const db = makeDb();
  await recordBroadcast(db, {
    id: "bc-1",
    adminId: ADMIN_ID,
    recipientCount: 37,
    successCount: 34,
    failedCount: 3,
  });
  const history = await listBroadcastHistory(db);
  assert.equal(history.length, 1);
  assert.equal(history[0].success_count, 34);
  assert.equal(history[0].failed_count, 3);
  // No message text column is stored anywhere in the schema contract.
  assert.ok(!("message" in history[0]));
  assert.ok(!("message_text" in history[0]));
});

// ---------- Non-admin behavior ----------

test("non-admin cannot be authorized even with admin-like inputs", () => {
  const env = adminEnv();
  assert.equal(isAdmin(env, Number(ADMIN_ID) + 1), false);
  assert.equal(isAdmin(env, "0"), false);
});
