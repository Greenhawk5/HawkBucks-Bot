export const DAILY_REMINDER_TIME = {
  hour: 0,
  minute: 0,
  second: 15,
  timezone: "UTC",
};
// export const DAILY_REMINDER_TIME = {
//   hour: 21,
//   minute: 0,
//   timezone: "Asia/Tehran",
// };

// Cloudflare cron expressions run in UTC and only support minute granularity.
// The reminder must run at 00:00:15 UTC: the cron fires at 00:00:00 UTC and
// DAILY_REMINDER_DELAY_MS applies the remaining 15-second offset inside the
// scheduled handler's ctx.waitUntil (timers are reliable there; scheduled
// handlers get up to 15 minutes of wall time). Keep the cron aligned with
// the trigger declared in wrangler.jsonc.
export const DAILY_REMINDER_CRON = "0 0 * * *";

// Delay between the 00:00:00 UTC cron firing and the start of the daily
// mission/reminder processing (00:00:15 UTC total).
export const DAILY_REMINDER_DELAY_MS = 15_000;

// Makes local/manual executions easier to repeat without sharing the normal
// production cycle lock. This must remain false in production deployments.
export const ENABLE_TEST_REMINDER = false;
