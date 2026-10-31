// End-to-end tests for runDailyReminder() (src/jobs/dailyReminder.js) running
// against real SQLite (test/helpers/d1-lite.js) with a stubbed Telegram API.
//
// Pinned behavior:
//   - a successful run marks the cycle 'completed',
//   - a completed cycle is never re-run (duplicate broadcast protection),
//   - a pre-delivery failure marks the cycle 'failed' (retained in D1) and
//     propagates, while staying retryable,
//   - Telegram failures halfway through the broadcast are counted per
//     recipient and still complete the cycle (existing design),
//   - a failure AFTER delivery never releases the cycle into a retryable
//     state, so a retry can never double-send.

import assert from "node:assert/strict";
import test from "node:test";
import { createD1, queryAll } from "./helpers/d1-lite.js";
import { captureConsole } from "./helpers/capture-console.js";
import { runDailyReminder, getReminderCycleKey } from "../src/jobs/dailyReminder.js";
import { acquireReminderRun, completeReminderRun } from "../database/reminder-runs.js";

const TODAY = new Date().toISOString().slice(0, 10);
const CYCLE_KEY = getReminderCycleKey();

const MISSIONS = [
  { zone: "Stonewood", powerLevel: 9, reward: { amount: 50 }, mission: { type: "Deliver the Bomb", category: "Industrial Park" } },
  { zone: "Twine Peaks", powerLevel: 45, reward: { amount: 50 }, mission: { type: "Ride the Lightning", category: "City" } },
];

function seedRecipients(db) {
  db.raw.prepare("INSERT INTO users (telegram_id, reminder_enabled) VALUES ('111', 1), ('222', 0)").run();
  db.raw.prepare("INSERT INTO groups (id, title, type, reminder_enabled) VALUES ('-1001', 'Group One', 'supergroup', 1)").run();
  db.raw.prepare("INSERT INTO channels (id, title, type, reminder_enabled) VALUES ('-2001', 'Channel One', 'channel', 1)").run();
}

function seedMissionCache(db) {
  db.raw.prepare(
    "INSERT INTO mission_images (date, telegram_file_id, missions_json, status) VALUES (?, ?, ?, 'ready')"
  ).run(TODAY, "cached-file-id", JSON.stringify(MISSIONS));
}

function runRow(db) {
  return queryAll(db, "SELECT * FROM reminder_runs WHERE cycle_key = ?", CYCLE_KEY)[0] || null;
}

// Telegram stub: every sendPhoto call resolves unless a custom
// `respond(callIndex)` returns a failing payload or throws.
function installTelegramStub(respond = () => ({ ok: true, result: { message_id: 1 } })) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body });
    const payload = respond(calls.length - 1, calls);
    if (payload instanceof Error) throw payload;
    return { ok: true, status: 200, json: async () => payload };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const ENV = (db) => ({ TELEGRAM_BOT_TOKEN: "test-token", hawkbucks_db: db });

test("a successful run with zero recipients completes and marks the cycle completed", async () => {
  const db = createD1();
  const logs = captureConsole();
  try {
    const result = await runDailyReminder(ENV(db));
    assert.deepEqual(result, { sent: 0, failed: 0 });
    assert.equal(runRow(db).status, "completed");
    assert.ok(logs.first("CRON_REMINDER_STARTED"));
    assert.deepEqual(logs.first("RECIPIENTS_FOUND").data, { users: 0, groups: 0, channels: 0 });
    assert.ok(logs.first("CRON_REMINDER_COMPLETED"));
    assert.equal(logs.first("CRON_REMINDER_FAILED"), undefined);
  } finally {
    logs.restore();
  }
});

test("duplicate protection: an already-completed cycle is skipped without sending", async () => {
  const db = createD1();
  const telegram = installTelegramStub();
  const logs = captureConsole();
  try {
    // Simulate yesterday's (or an earlier invocation's) completed run today.
    db.raw.prepare("INSERT INTO reminder_runs (cycle_key, status) VALUES (?, 'completed')").run(CYCLE_KEY);

    const result = await runDailyReminder(ENV(db));
    assert.deepEqual(result, { skipped: true, reason: "duplicate_cycle" });
    assert.equal(telegram.calls.length, 0, "no Telegram call may happen for a duplicate cycle");
    assert.ok(logs.first("CRON_REMINDER_SKIPPED_DUPLICATE"));
    assert.equal(logs.first("CRON_REMINDER_STARTED").data.cycleKey, CYCLE_KEY);
  } finally {
    logs.restore();
    telegram.restore();
  }
});

test("a broadcast run delivers to every enabled recipient and completes the cycle", async () => {
  const db = createD1();
  seedRecipients(db);
  seedMissionCache(db);
  const telegram = installTelegramStub();
  const logs = captureConsole();
  try {
    const result = await runDailyReminder(ENV(db));
    // 1 enabled user + 1 enabled group + 1 enabled channel (disabled user skipped).
    assert.deepEqual(result, { sent: 3, failed: 0 });
    assert.equal(runRow(db).status, "completed");
    assert.equal(telegram.calls.length, 3, "sendPhoto must be called once per enabled recipient");
    assert.ok(telegram.calls.every((call) => call.url.includes("/sendPhoto")));
    assert.deepEqual(logs.first("RECIPIENTS_FOUND").data, { users: 1, groups: 1, channels: 1 });
    assert.equal(logs.all("MESSAGE_SENT").length, 3);
    assert.equal(logs.first("BROADCAST_STARTED").data.recipients, 3);
    assert.equal(logs.first("MISSION_FETCH_COMPLETED").data.cached, true, "cache hit must be observable");
    assert.deepEqual(logs.first("CRON_REMINDER_COMPLETED").data, { cycleKey: CYCLE_KEY, sent: 3, failed: 0 });
  } finally {
    logs.restore();
    telegram.restore();
  }
});

test("a pre-delivery failure marks the run failed (retained in D1), propagates, and stays retryable", async () => {
  const failingDb = createD1({
    intercept(sql) {
      if (/FROM users/i.test(sql)) throw new Error("recipient query failed");
    },
  });
  const logs = captureConsole();
  try {
    await assert.rejects(
      runDailyReminder(ENV(failingDb)),
      /recipient query failed/,
      "pre-delivery failures must propagate to the caller (scheduled())"
    );

    // The failure must be visible in D1 — not deleted — and nothing sent.
    const row = runRow(failingDb);
    assert.ok(row, "failed run must be retained in reminder_runs");
    assert.equal(row.status, "failed");
    assert.ok(row.completed_at, "failure time must be recorded");

    const failedLog = logs.first("CRON_REMINDER_FAILED");
    assert.equal(failedLog.data.error, "recipient query failed");
    assert.equal(failedLog.data.sent, 0);
    assert.equal(logs.first("CRON_REMINDER_COMPLETED"), undefined);

    // ...and the same cycle must still be retryable afterwards.
    assert.equal(await acquireReminderRun(failingDb, CYCLE_KEY), true,
      "a failed run must not permanently block the cycle");
  } finally {
    logs.restore();
  }
});

test("Telegram failing halfway: delivery errors are counted and the cycle still completes", async () => {
  const db = createD1();
  seedRecipients(db);
  seedMissionCache(db);
  // 3 recipients: first two sends succeed, the third gets a Telegram rejection.
  const telegram = installTelegramStub((index) =>
    index === 2 ? { ok: false, description: "bad request" } : { ok: true, result: { message_id: 1 } });
  const logs = captureConsole();
  try {
    const result = await runDailyReminder(ENV(db));
    assert.deepEqual(result, { sent: 2, failed: 1 }, "partial delivery must not throw or abort");
    assert.equal(runRow(db).status, "completed",
      "a partially failed broadcast completes the cycle — no duplicate retry");
    assert.equal(logs.all("MESSAGE_SENT").length, 2);
    assert.equal(logs.all("MESSAGE_FAILED").length, 1);
    assert.match(logs.first("MESSAGE_FAILED").data.error, /sendPhoto failed/);
    assert.deepEqual(logs.first("CRON_REMINDER_COMPLETED").data, { cycleKey: CYCLE_KEY, sent: 2, failed: 1 });
  } finally {
    logs.restore();
    telegram.restore();
  }
});

test("a failure AFTER delivery keeps the cycle locked so a retry can never double-send", async () => {
  const db = createD1({
    intercept(sql) {
      // Simulate D1 failing exactly when the run tries to finalize.
      if (sql.includes("SET status = 'completed'")) throw new Error("finalization boom");
    },
  });
  seedRecipients(db);
  seedMissionCache(db);
  const telegram = installTelegramStub();
  const logs = captureConsole();
  try {
    await assert.rejects(runDailyReminder(ENV(db)), /finalization boom/);

    assert.equal(logs.all("MESSAGE_SENT").length, 3, "the messages were already delivered");
    assert.equal(logs.first("CRON_REMINDER_FINALIZE_FAILED")?.name, "CRON_REMINDER_FINALIZE_FAILED",
      "finalization failure must be explicitly logged");
    assert.equal(logs.first("CRON_REMINDER_FAILED").data.sent, 3);

    // The row must remain 'running' (lock held) — NOT released to 'failed' —
    // so an immediate retry is refused instead of double-sending.
    assert.equal(runRow(db).status, "running");
    assert.equal(await acquireReminderRun(db, CYCLE_KEY), false,
      "a cycle with delivered messages must never be re-acquired");
    assert.equal(telegram.calls.length, 3, "no additional Telegram call may happen");
  } finally {
    logs.restore();
    telegram.restore();
  }
});

test("a completed cycle survives as terminal state (successful runs are marked complete)", async () => {
  const db = createD1();
  const logs = captureConsole();
  try {
    await runDailyReminder(ENV(db));
    const row = runRow(db);
    assert.equal(row.status, "completed");
    assert.ok(row.completed_at, "completion time must be recorded");
    // Even a direct complete-then-release sequence cannot downgrade it.
    await completeReminderRun(db, CYCLE_KEY);
    assert.equal(runRow(db).status, "completed");
  } finally {
    logs.restore();
  }
});

