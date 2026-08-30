// D1-backed usage statistics and active-reminder queries.
// All aggregation happens in the database; the Worker only formats results.
// Timezone policy: everything is UTC (matches D1 CURRENT_TIMESTAMP and the
// rest of the bot's reminder/mission logic).

export function periodStartIso(period, now = new Date()) {
  const d = new Date(now);
  switch (period) {
    case "day": {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    case "week": {
      // Week starts Monday 00:00 UTC.
      const day = (d.getUTCDay() + 6) % 7;
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
    }
    case "month": {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    }
    case "6months": {
      const start = new Date(d);
      start.setUTCMonth(start.getUTCMonth() - 6);
      return start;
    }
    case "year": {
      const start = new Date(d);
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      return start;
    }
    default:
      return null;
  }
}

export const PERIODS = ["day", "week", "month", "6months", "year"];

export const PERIOD_LABELS = {
  day: "Today",
  week: "Current Week",
  month: "Current Month",
  "6months": "Last 6 Months",
  year: "Last 12 Months",
};

// D1 CURRENT_TIMESTAMP format is 'YYYY-MM-DD HH:MM:SS' (UTC); ISO strings
// with a 'T' also compare correctly as strings against that format only if
// normalized, so convert to the D1 format explicitly.
function toD1Timestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function getUsageStats(db, period, now = new Date()) {
  const start = periodStartIso(period, now);
  if (!start) return null;
  const since = toD1Timestamp(start);

  const [users, groups, channels] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE last_seen >= ?").bind(since).first(),
    db.prepare("SELECT COUNT(*) AS c FROM groups WHERE last_seen >= ?").bind(since).first(),
    db.prepare("SELECT COUNT(*) AS c FROM channels WHERE last_seen >= ?").bind(since).first(),
  ]);

  const userCount = Number(users?.c || 0);
  const groupCount = Number(groups?.c || 0);
  const channelCount = Number(channels?.c || 0);

  return {
    period,
    since,
    users: userCount,
    groups: groupCount,
    channels: channelCount,
    total: userCount + groupCount + channelCount,
  };
}

export async function getActiveReminderCounts(db) {
  const [users, groups, channels] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE reminder_enabled = 1").first(),
    db.prepare("SELECT COUNT(*) AS c FROM groups WHERE reminder_enabled = 1").first(),
    db.prepare("SELECT COUNT(*) AS c FROM channels WHERE reminder_enabled = 1").first(),
  ]);
  return {
    users: Number(users?.c || 0),
    groups: Number(groups?.c || 0),
    channels: Number(channels?.c || 0),
  };
}

export async function listActiveReminderUsers(db, { offset = 0, limit = 10 } = {}) {
  const rows = await db.prepare(
    `SELECT telegram_id, username, first_name, last_seen FROM users
     WHERE reminder_enabled = 1
     ORDER BY last_seen DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  return rows.results || [];
}

export async function listActiveReminderChats(db, table, { offset = 0, limit = 10 } = {}) {
  if (!["groups", "channels"].includes(table)) return [];
  const rows = await db.prepare(
    `SELECT id, title, type, reminder_enabled FROM ${table}
     WHERE reminder_enabled = 1
     ORDER BY id LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  return rows.results || [];
}

// Per-entity activity listings for the Usage Statistics PDF.
export async function listActiveUsersSince(db, since, limit = 500) {
  const rows = await db.prepare(
    `SELECT telegram_id, username, first_name, last_seen FROM users
     WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT ?`
  ).bind(since, limit).all();
  return rows.results || [];
}

export async function listActiveChatsSince(db, table, since, limit = 500) {
  if (!["groups", "channels"].includes(table)) return [];
  const rows = await db.prepare(
    `SELECT id, title, reminder_enabled, last_seen FROM ${table}
     WHERE last_seen >= ? ORDER BY last_seen DESC LIMIT ?`
  ).bind(since, limit).all();
  return rows.results || [];
}
