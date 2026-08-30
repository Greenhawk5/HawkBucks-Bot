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

function filterClause(filter) {
  switch (filter) {
    case "on": return "reminder_enabled = 1";
    case "off": return "reminder_enabled = 0";
    case "active": return `last_seen >= datetime('now', '-${ACTIVE_WINDOW_DAYS} days')`;
    case "inactive": return `(last_seen IS NULL OR last_seen < datetime('now', '-${ACTIVE_WINDOW_DAYS} days'))`;
    case "all":
    default: return "1=1";
  }
}

export async function listBroadcastRecipients(db, type, filter, { offset = 0, limit = 10 } = {}) {
  const cfg = recipientType(type);
  if (!cfg) return [];
  const where = filterClause(filter);
  const rows = await db.prepare(
    `SELECT ${cfg.columns} FROM ${cfg.table}
     WHERE ${where} ORDER BY ${cfg.idColumn} LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();
  return (rows.results || []).map(cfg.normalize);
}

export async function countBroadcastRecipients(db, type, filter) {
  const cfg = recipientType(type);
  if (!cfg) return 0;
  const where = filterClause(filter);
  const row = await db.prepare(`SELECT COUNT(*) AS c FROM ${cfg.table} WHERE ${where}`).first();
  return Number(row?.c || 0);
}
