export const DAILY_REMINDER_TIME = {
  hour: 0,
  minute: 5,
  timezone: "UTC",
};
// export const DAILY_REMINDER_TIME = {
//   hour: 21,
//   minute: 0,
//   timezone: "Asia/Tehran",
// };

// Cloudflare cron expressions run in UTC. Keep this value aligned with the
// trigger declared in wrangler.jsonc.
export const DAILY_REMINDER_CRON = "5 0 * * *";

// Makes local/manual executions easier to repeat without sharing the normal
// production cycle lock. This must remain false in production deployments.
export const ENABLE_TEST_REMINDER = false;
