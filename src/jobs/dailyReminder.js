import { getReminderRecipients } from "../services/reminderRecipients.js";
import {
  prepareMissionReminder,
  releasePreparedMissionReminder,
  sendMissionReminder,
} from "../services/notification.js";
import { DAILY_REMINDER_TIME, ENABLE_TEST_REMINDER } from "../config/reminders.js";
import { acquireReminderRun, completeReminderRun, releaseReminderRun } from "../../database/reminder-runs.js";

function reminderDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_REMINDER_TIME.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function getReminderCycleKey(now = new Date()) {
  const base = `daily:${reminderDate(now)}:${DAILY_REMINDER_TIME.hour}:${DAILY_REMINDER_TIME.minute}:${DAILY_REMINDER_TIME.timezone}`;
  return ENABLE_TEST_REMINDER ? `${base}:test:${now.toISOString().slice(0, 16)}` : base;
}

export async function runDailyReminder(env) {
  const db = env.hawkbucks_db;
  const cycleKey = getReminderCycleKey();
  console.log("CRON_REMINDER_STARTED", { cycleKey, reminderTime: DAILY_REMINDER_TIME });

  const acquired = await acquireReminderRun(db, cycleKey);
  if (!acquired) {
    console.log("CRON_REMINDER_SKIPPED_DUPLICATE", { cycleKey });
    return { skipped: true, reason: "duplicate_cycle" };
  }

  let reminder;
  try {
    const recipients = await getReminderRecipients(db);
    const counts = recipients.reduce((result, recipient) => {
      result[recipient.type] += 1;
      return result;
    }, { user: 0, group: 0, channel: 0 });
    console.log("RECIPIENTS_FOUND", { users: counts.user, groups: counts.group, channels: counts.channel });

    if (recipients.length === 0) {
      await completeReminderRun(db, cycleKey);
      console.log("CRON_REMINDER_COMPLETED", { cycleKey, sent: 0, failed: 0 });
      return { sent: 0, failed: 0 };
    }

    reminder = await prepareMissionReminder(env, db);
    console.log("MISSION_FETCH_COMPLETED", { cached: Boolean(reminder.telegramFileId), missionCount: reminder.missions.length });
    console.log("BROADCAST_STARTED", { recipients: recipients.length });

    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
      try {
        await sendMissionReminder(recipient.chatId, env, db, { preparedReminder: reminder });
        sent += 1;
        console.log("MESSAGE_SENT", { chatId: recipient.chatId, type: recipient.type });
      } catch (error) {
        failed += 1;
        console.error("MESSAGE_FAILED", { chatId: recipient.chatId, type: recipient.type, error: error.message });
      }
    }

    await releasePreparedMissionReminder(db, reminder);
    await completeReminderRun(db, cycleKey);
    console.log("CRON_REMINDER_COMPLETED", { cycleKey, sent, failed });
    return { sent, failed };
  } catch (error) {
    await releasePreparedMissionReminder(db, reminder);
    await releaseReminderRun(db, cycleKey);
    console.error("CRON_REMINDER_FAILED", { cycleKey, error: error.message });
    throw error;
  }
}
