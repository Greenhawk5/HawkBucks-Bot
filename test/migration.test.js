import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isIgnorableSchemaError } from "../scripts/deploy-d1-schema.js";

const schema = await readFile("database/schema.sql", "utf8");
const migration = await readFile("database/migrations/0002_chat_last_seen.sql", "utf8");

// ---------- Fresh database (schema.sql) ----------

test("fresh schema contains no ALTER TABLE statements (one-pass install)", () => {
  assert.equal((schema.match(/ALTER TABLE/gi) || []).length, 0);
});

test("fresh schema includes last_seen in groups and channels CREATE TABLEs", () => {
  const groupsBlock = schema.match(/CREATE TABLE IF NOT EXISTS groups\s*\(([\s\S]*?)\);/i)?.[1] || "";
  const channelsBlock = schema.match(/CREATE TABLE IF NOT EXISTS channels\s*\(([\s\S]*?)\);/i)?.[1] || "";
  assert.ok(/last_seen\s+DATETIME/.test(groupsBlock), "groups must define last_seen");
  assert.ok(/last_seen\s+DATETIME/.test(channelsBlock), "channels must define last_seen");
});

test("fresh schema creates admin_sessions and broadcast_history", () => {
  assert.ok(/CREATE TABLE IF NOT EXISTS admin_sessions/.test(schema));
  assert.ok(/CREATE TABLE IF NOT EXISTS broadcast_history/.test(schema));
});

// ---------- Migration 0002 (existing v1.0.0 database) ----------

test("migration adds last_seen to groups and channels", () => {
  assert.ok(/ALTER TABLE groups\s+ADD COLUMN last_seen/i.test(migration));
  assert.ok(/ALTER TABLE channels\s+ADD COLUMN last_seen/i.test(migration));
});

test("migration creates admin_sessions and broadcast_history", () => {
  assert.ok(/CREATE TABLE IF NOT EXISTS admin_sessions/.test(migration));
  assert.ok(/CREATE TABLE IF NOT EXISTS broadcast_history/.test(migration));
});

test("migration is non-destructive (DDL only, no data loss statements)", () => {
  assert.ok(!/\bDROP\s+TABLE\b/i.test(migration));
  assert.ok(!/\bDELETE\s+FROM\b/i.test(migration));
  assert.ok(!/\bUPDATE\s+\w+\s+SET\b/i.test(migration));
  assert.ok(!/\bTRUNCATE\b/i.test(migration));
});

test("migration combined with schema covers every v1.1.0 requirement", () => {
  const required = [
    "groups", "channels", "admin_sessions", "broadcast_history",
    "last_seen", "state_json", "recipient_count",
  ];
  const combined = `${schema}\n${migration}`;
  for (const term of required) {
    assert.ok(combined.includes(term), `missing: ${term}`);
  }
});

// ---------- Deploy script idempotency classification ----------

test("deploy script skips only duplicate-object errors", () => {
  assert.equal(isIgnorableSchemaError("duplicate column name: last_seen"), true);
  assert.equal(isIgnorableSchemaError("table admin_sessions already exists"), true);
  assert.equal(isIgnorableSchemaError("already exists"), true);
});

test("deploy script aborts on real schema errors", () => {
  assert.equal(isIgnorableSchemaError("no such table: mission_images"), false);
  assert.equal(isIgnorableSchemaError("syntax error near"), false);
  assert.equal(isIgnorableSchemaError(""), false);
  assert.equal(isIgnorableSchemaError(undefined), false);
});

test("migration comments document repeat behavior", () => {
  assert.ok(migration.includes("duplicate column"));
  assert.ok(migration.includes("deploy-d1-schema.js"));
});
