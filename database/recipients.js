// Recipient queries for the admin broadcast flow.
//
// Users, groups and channels have DIFFERENT schemas (see database/schema.sql):
//   users:    telegram_id, username, first_name, reminder_enabled, last_seen
//   groups:   id, title, reminder_enabled, last_seen
//   channels: id, title, reminder_enabled, last_seen
// Each type therefore gets its own projection; only columns that actually
// exist are queried. Results are normalized into a common application shape:
//   { id, type, displayName, username, reminderEnabled, lastSeen }
//
// Delivery re-resolves IDs at send time; the 45-recipient cap is enforced
// in the broadcast module.

const ACTIVE_WINDOW_DAYS = 7;

// D1 CURRENT_TIMESTAMP / datetime() values are stored as
// 'YYYY-MM-DD HH:MM:SS' (UTC). Activity cutoffs are therefore formatted the
// same way so plain string comparisons behave identically in D1 and in the
// fake test database.
function toD1Timestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

// Cutoff for the "recently active" recipient filters. Computed on the Worker
// side (instead of datetime('now') inside SQL) so the reference time is
// injectable: production defaults to the actual current time, while tests
// pass a fixed `now` for deterministic results.
export function activityCutoff(now = new Date(), windowDays = ACTIVE_WINDOW_DAYS) {
  return toD1Timestamp(new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000));
}

const RECIPIENT_TYPES = {
  users: {
    table: "users",
    idColumn: "telegram_id",
    columns: "telegram_id, first_name, username, reminder_enabled, last_seen",
    normalize: (r) => ({
      id: String(r.telegram_id),
      type: "users",
      displayName: r.first_name || r.username || `User ${r.telegram_id}`,
      username: r.username ?? null,
      reminderEnabled: Number(r.reminder_enabled) === 1,
      lastSeen: r.last_seen ?? null,
    }),
  },
  groups: {
    table: "groups",
    idColumn: "id",
    columns: "id, title, reminder_enabled, last_seen",
    normalize: (r) => ({
      id: String(r.id),
      type: "groups",
      displayName: r.title || `Group ${r.id}`,
      username: null, // groups have no username column
      reminderEnabled: Number(r.reminder_enabled) === 1,
      lastSeen: r.last_seen ?? null,
    }),
  },
};

export function recipientType(type) {
  return RECIPIENT_TYPES[type] || null;
}

function filterClause(filter, cutoff) {
  switch (filter) {
    case "on": return "reminder_enabled = 1";
    case "off": return "reminder_enabled = 0";
    case "active": return "last_seen >= ?";
    case "inactive": return "(last_seen IS NULL OR last_seen < ?)";
    case "all":
    default: return "1=1";
  }
}

export async function listBroadcastRecipients(db, type, filter, {
  offset = 0,
  limit = 10,
  now = new Date(),
  activityWindowDays = ACTIVE_WINDOW_DAYS,
} = {}) {
  const cfg = recipientType(type);
  if (!cfg) return [];
  const cutoff = activityCutoff(now, activityWindowDays);
  const where = filterClause(filter, cutoff);
  const rows = await db.prepare(
    `SELECT ${cfg.columns} FROM ${cfg.table}
     WHERE ${where} ORDER BY ${cfg.idColumn} LIMIT ? OFFSET ?`
  ).bind(cutoff, limit, offset).all();
  return (rows.results || []).map(cfg.normalize);
}

export async function countBroadcastRecipients(db, type, filter, {
  now = new Date(),
  activityWindowDays = ACTIVE_WINDOW_DAYS,
} = {}) {
  const cfg = recipientType(type);
  if (!cfg) return 0;
  const cutoff = activityCutoff(now, activityWindowDays);
  const where = filterClause(filter, cutoff);
  const row = await db.prepare(`SELECT COUNT(*) AS c FROM ${cfg.table} WHERE ${where}`).bind(cutoff).first();
  return Number(row?.c || 0);
}
