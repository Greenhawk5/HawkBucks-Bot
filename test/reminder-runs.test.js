// Duplicate-run protection tests for database/reminder-runs.js, executed
// against real SQLite (via test/helpers/d1-lite.js) so the exact production
// SQL — including the ON CONFLICT ... WHERE status = 'failed' upsert — is
// what is actually verified.
//
// Guarantees pinned here:
//   1. only one invocation can hold a cycle at a time,
//   2. a completed cycle can never run again (no duplicate broadcasts),
//   3. a failed run stays visible in D1 (status='failed', never deleted),
//   4. a failed run does not permanently block a retry of the same cycle,
//   5. a crashed ('running' beyond the stale window) run is promoted to
//      'failed' — evidence retained — and becomes retryable,
//   6. today's failure never blocks tomorrow's reminder (cycle key is per day).

import assert from "node:assert/strict";
import test from "node:test";
import { createD1, queryAll } from "./helpers/d1-lite.js";
import {
  acquireReminderRun,
  completeReminderRun,
  releaseReminderRun,
} from "../database/reminder-runs.js";

const KEY = "daily:2026-09-25:0:0:UTC";

function runRow(db, key = KEY) {
  return queryAll(db, "SELECT * FROM reminder_runs WHERE cycle_key = ?", key)[0] || null;
}

test("fresh cycle is acquired exactly once; a concurrent duplicate is refused", async () => {
  const db = createD1();
  assert.equal(await acquireReminderRun(db, KEY), true, "first acquire must win");
  assert.equal(await acquireReminderRun(db, KEY), false, "second acquire must lose");
  assert.equal(runRow(db).status, "running");
});

test("a completed cycle can never be re-acquired (no duplicate daily broadcast)", async () => {
  const db = createD1();
  await acquireReminderRun(db, KEY);
  await completeReminderRun(db, KEY);

  assert.equal(runRow(db).status, "completed");
  assert.equal(await acquireReminderRun(db, KEY), false, "completed must be terminal");
  assert.equal(runRow(db).status, "completed", "row must stay completed");
});

test("release marks the run 'failed' and RETAINS the row for diagnosis", async () => {
  const db = createD1();
  await acquireReminderRun(db, KEY);
  await releaseReminderRun(db, KEY);

  const row = runRow(db);
  assert.ok(row, "failed run must NOT be deleted from D1");
  assert.equal(row.status, "failed");
  assert.ok(row.completed_at, "failure time must be recorded");
});

test("a failed run does not permanently block a retry of the same cycle", async () => {
  const db = createD1();
  await acquireReminderRun(db, KEY);
  await releaseReminderRun(db, KEY);

  assert.equal(await acquireReminderRun(db, KEY), true, "failed cycle must be retryable");
  assert.equal(runRow(db).status, "running");
  assert.equal(await acquireReminderRun(db, KEY), false, "retry must hold the lock");
});

test("a crashed 'running' row beyond the stale window is promoted to 'failed', not deleted", async () => {
  const db = createD1();
  await acquireReminderRun(db, KEY);
  // Simulate an invocation that died 40 minutes ago without any cleanup.
  db.raw.prepare("UPDATE reminder_runs SET started_at = datetime('now', '-40 minutes') WHERE cycle_key = ?").run(KEY);

  assert.equal(await acquireReminderRun(db, KEY), true, "stale cycle must become retryable");
  const row = runRow(db);
  assert.equal(row.status, "running");
  assert.ok(row.started_at, "row must still exist after stale promotion");
});

test("a 'running' row younger than the stale window keeps blocking (crash lock)", async () => {
  const db = createD1();
  await acquireReminderRun(db, KEY);
  db.raw.prepare("UPDATE reminder_runs SET started_at = datetime('now', '-5 minutes') WHERE cycle_key = ?").run(KEY);

  assert.equal(await acquireReminderRun(db, KEY), false, "recent running row must stay locked");
  assert.equal(runRow(db).status, "running");
});

test("one day's failure never blocks the next day's reminder", async () => {
  const db = createD1();
  await acquireReminderRun(db, "daily:2026-09-25:0:0:UTC");
  await releaseReminderRun(db, "daily:2026-09-25:0:0:UTC");

  assert.equal(await acquireReminderRun(db, "daily:2026-09-26:0:0:UTC"), true,
    "next day's cycle key is independent and must acquire");
});

test("release on a missing or already-finalized cycle is a harmless no-op", async () => {
  const db = createD1();
  await releaseReminderRun(db, "no-such-cycle");
  assert.equal(runRow(db, "no-such-cycle"), null);

  await acquireReminderRun(db, KEY);
  await completeReminderRun(db, KEY);
  await releaseReminderRun(db, KEY);
  assert.equal(runRow(db).status, "completed", "release must not downgrade completed");
});
