// Regression tests for the daily reminder schedule (introduced in v1.2.0,
// retimed to 00:00:15 UTC in v1.2.5): the reminder must start at 00:00:15 UTC,
// implemented as a 00:00 UTC cron plus a fixed 15-second in-handler delay
// (Cloudflare cron has minute granularity, so the sub-minute offset cannot
// live in the cron expression).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DAILY_REMINDER_TIME,
  DAILY_REMINDER_CRON,
  DAILY_REMINDER_DELAY_MS,
} from "../src/config/reminders.js";
import { getReminderCycleKey } from "../src/jobs/dailyReminder.js";

test("daily reminder executes at 00:00:15 UTC (cron at midnight + 15s delay)", () => {
  assert.deepEqual(DAILY_REMINDER_TIME, {
    hour: 0,
    minute: 0,
    second: 15,
    timezone: "UTC",
  });
  assert.equal(DAILY_REMINDER_CRON, "0 0 * * *");
  assert.equal(DAILY_REMINDER_DELAY_MS, 15_000);
});

test("the cron trigger in wrangler.jsonc is aligned with DAILY_REMINDER_CRON", () => {
  const config = readFileSync(
    new URL("../wrangler.jsonc", import.meta.url),
    "utf8"
  );
  const crons = JSON.parse(config.replace(/^\s*\/\/.*$/gm, "")).triggers.crons;
  assert.ok(crons.includes(DAILY_REMINDER_CRON), `crons must include "${DAILY_REMINDER_CRON}"`);
  assert.ok(
    !crons.includes("5 0 * * *"),
    "the legacy 00:05 cron must not remain configured"
  );
});

test("the reminder cycle key reflects the new schedule", () => {
  const key = getReminderCycleKey(new Date("2026-09-03T00:00:15Z"));
  assert.ok(key.startsWith("daily:2026-09-03:0:0:UTC"), key);
  assert.ok(!key.includes(":5:"), "the 00:05 schedule must not leak into the cycle key");
});
