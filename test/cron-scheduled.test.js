// Lifecycle tests for the scheduled() handler (src/index.js).
//
// Production incident (2026-09-25): the cron invocation logged
// CRON_TRIGGER_RECEIVED and then scheduled() returned immediately, parking the
// ENTIRE reminder pipeline inside ctx.waitUntil(). The invocation was recorded
// with $workers.outcome = "canceled" and $workers.wallTimeMs = 3991 — the
// JavaScript context closed ~4 seconds in, inside the 15-second delay, so
// runDailyReminder() never executed (no CRON_REMINDER_STARTED was ever logged).
//
// Per Cloudflare's Scheduled Handler documentation, the runtime waits for the
// promise RETURNED by scheduled() (up to the 15-minute duration limit), so a
// single critical task must be awaited directly instead of fire-and-forget
// via waitUntil(). These tests pin that lifecycle, the timing instrumentation
// (scheduler delay vs. intentional delay), and failure propagation.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { DAILY_REMINDER_CRON, DAILY_REMINDER_DELAY_MS } from "../src/config/reminders.js";
import { createD1 } from "./helpers/d1-lite.js";
import { captureConsole } from "./helpers/capture-console.js";

function fakeCtx() {
  const tasks = [];
  return { tasks, waitUntil(promise) { tasks.push(promise); } };
}

// Replaces the Workers `scheduler` global with a stub that records every
// scheduler.wait(ms) call and resolves after a couple of milliseconds, so no
// test ever waits a real 15 seconds.
function stubScheduler() {
  const calls = [];
  const original = globalThis.scheduler;
  globalThis.scheduler = {
    async wait(ms) {
      calls.push(ms);
      await new Promise((resolve) => setTimeout(resolve, 2));
    },
  };
  return {
    calls,
    restore() {
      if (original === undefined) delete globalThis.scheduler;
      else globalThis.scheduler = original;
    },
  };
}

test("scheduled() awaits the whole reminder pipeline before resolving", async () => {
  const env = { hawkbucks_db: createD1() }; // no recipients -> fast clean completion
  const scheduler = stubScheduler();
  const logs = captureConsole();
  const ctx = fakeCtx();
  try {
    // Cloudflare started this invocation 73 seconds late (like production
    // 2026-09-25, where the handler started at 00:01:13 for a 00:00:00 cron).
    const scheduledTime = Date.now() - 73_000;
    await worker.scheduled({ cron: DAILY_REMINDER_CRON, scheduledTime }, env, ctx);

    // Full lifecycle must occur, in order, inside ONE awaited invocation.
    const order = [
      "CRON_TRIGGER_RECEIVED",
      "CRON_DELAY_STARTED",
      "CRON_DELAY_FINISHED",
      "CRON_REMINDER_STARTED",
      "RECIPIENTS_FOUND",
      "CRON_REMINDER_COMPLETED",
      "CRON_TASK_COMPLETED",
    ];
    const names = logs.names();
    let previous = -1;
    for (const name of order) {
      const index = names.indexOf(name);
      assert.ok(index > previous,
        `expected ${name} after the previous lifecycle event; got: ${names.join(" > ")}`);
      previous = index;
    }

    // The 15-second offset is applied through the Workers scheduler API and
    // is fully awaited before the reminder starts (see order above).
    assert.deepEqual(scheduler.calls, [DAILY_REMINDER_DELAY_MS],
      "the intentional delay must be awaited via scheduler.wait(DAILY_REMINDER_DELAY_MS)");

    // Scheduler lateness is measured separately from the intentional delay.
    const trigger = logs.first("CRON_TRIGGER_RECEIVED").data;
    assert.equal(trigger.cron, DAILY_REMINDER_CRON);
    assert.equal(trigger.scheduledTime, new Date(scheduledTime).toISOString());
    assert.ok(typeof trigger.actualTime === "string");
    assert.ok(trigger.schedulerDelayMs >= 73_000 && trigger.schedulerDelayMs < 74_000,
      `schedulerDelayMs must reflect Cloudflare-side lateness, got ${trigger.schedulerDelayMs}`);

    const delayStarted = logs.first("CRON_DELAY_STARTED").data;
    assert.equal(delayStarted.delayMs, DAILY_REMINDER_DELAY_MS);
    assert.ok(Number.isFinite(Date.parse(delayStarted.delayTarget)));
    const delayFinished = logs.first("CRON_DELAY_FINISHED").data;
    assert.equal(delayFinished.delayMs, DAILY_REMINDER_DELAY_MS);
    assert.ok(delayFinished.waitedMs >= 0);

    // Terminal lifecycle event carries total duration + scheduler lateness.
    const completed = logs.first("CRON_TASK_COMPLETED").data;
    assert.ok(Number.isFinite(completed.totalDurationMs) && completed.totalDurationMs >= 0);
    assert.equal(completed.schedulerDelayMs, trigger.schedulerDelayMs);
    assert.deepEqual(completed.result, { sent: 0, failed: 0 });

    // Nothing may be parked in ctx.waitUntil: the awaited promise is the
    // invocation's lifetime boundary.
    assert.equal(ctx.tasks.length, 0, "scheduled() must not fire-and-forget the critical task");
  } finally {
    logs.restore();
    scheduler.restore();
  }
});


test("a missing scheduledTime degrades to schedulerDelayMs = 0 instead of crashing", async () => {
  const env = { hawkbucks_db: createD1() };
  const scheduler = stubScheduler();
  const logs = captureConsole();
  try {
    await worker.scheduled({ cron: DAILY_REMINDER_CRON }, env, fakeCtx());
    const trigger = logs.first("CRON_TRIGGER_RECEIVED").data;
    assert.equal(trigger.schedulerDelayMs, 0);
    assert.ok(logs.first("CRON_TASK_COMPLETED"), "the invocation must still complete");
  } finally {
    logs.restore();
    scheduler.restore();
  }
});

test("runDailyReminder failures propagate out of scheduled() and are logged", async () => {
  // Every D1 statement fails: the acquire step must surface the error at the
  // reminder level AND the invocation level, and the error must reject the
  // promise returned by scheduled() (so the Cron outcome records an exception
  // instead of a misleading success or cancel status).
  const env = {
    hawkbucks_db: {
      prepare() { throw new Error("simulated D1 outage"); },
    },
  };
  const scheduler = stubScheduler();
  const logs = captureConsole();
  try {
    await assert.rejects(
      worker.scheduled({ cron: DAILY_REMINDER_CRON, scheduledTime: Date.now() }, env, fakeCtx()),
      /simulated D1 outage/,
      "the failure must propagate out of scheduled()"
    );

    assert.equal(logs.first("CRON_TASK_COMPLETED"), undefined,
      "a failed invocation must not log a terminal success event");

    const reminderFailed = logs.first("CRON_REMINDER_FAILED");
    assert.ok(reminderFailed, "CRON_REMINDER_FAILED must be logged");
    assert.equal(reminderFailed.data.error, "simulated D1 outage");

    const taskFailed = logs.first("CRON_TASK_FAILED");
    assert.ok(taskFailed, "CRON_TASK_FAILED must be logged");
    assert.equal(taskFailed.data.error, "simulated D1 outage");
    assert.ok(Number.isFinite(taskFailed.data.totalDurationMs));
    assert.ok(Number.isFinite(taskFailed.data.schedulerDelayMs));
  } finally {
    logs.restore();
    scheduler.restore();
  }
});

test("REGRESSION: the reminder is awaited directly, never parked in ctx.waitUntil", () => {
  const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  // Strip comments so the assertions target executable code only (the comment
  // block legitimately references ctx.waitUntil when explaining the incident).
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  // Direct await of the critical task (the documented way to keep a single
  // scheduled task alive for up to 15 minutes).
  assert.match(code, /await runDailyReminder\(\s*env\s*\)/,
    "scheduled() must await runDailyReminder directly");
  assert.ok(!code.includes("ctx.waitUntil"),
    "src/index.js must not use ctx.waitUntil (the 2026-09-25 failure mode)");

  // Workers-native awaited delay.
  assert.match(code, /await scheduler\.wait\(DAILY_REMINDER_DELAY_MS\)/,
    "the 15-second offset must use scheduler.wait");

  // Timing instrumentation required to separate scheduler lateness from
  // application delay in future production logs.
  for (const field of ["scheduledTime", "actualTime", "schedulerDelayMs", "totalDurationMs"]) {
    assert.ok(source.includes(field), `scheduled() must log ${field}`);
  }
  for (const event of [
    "CRON_TRIGGER_RECEIVED",
    "CRON_DELAY_STARTED",
    "CRON_DELAY_FINISHED",
    "CRON_TASK_COMPLETED",
    "CRON_TASK_FAILED",
  ]) {
    assert.ok(source.includes(`"${event}"`), `scheduled() must log ${event}`);
  }

  // Failures must propagate to the runtime instead of being swallowed.
  assert.match(source, /throw error/, "scheduled() must rethrow reminder failures");
});
