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

export function buildRecipientFilter(type, filter, cutoff, { extraConditions = [] } = {}) {
  let base;
  switch (filter) {
    case "on":
      base = { clause: "reminder_enabled = 1", params: [] };
      break;
    case "off":
      base = { clause: "reminder_enabled = 0", params: [] };
      break;
    case "active":
      base = { clause: "last_seen >= ?", params: [cutoff] };
      break;
    case "inactive":
      base = { clause: "(last_seen IS NULL OR last_seen < ?)", params: [cutoff] };
      break;
    case "all":
    default:
      base = { clause: "1=1", params: [] };
      break;
  }

  if (!extraConditions.length) {
    return base;
  }

  const clauses = [base.clause];
  const params = [...base.params];
  for (const cond of extraConditions) {
    if (cond?.clause) {
      clauses.push(cond.clause);
      if (Array.isArray(cond.params)) {
        params.push(...cond.params);
      }
    }
  }

  return { clause: clauses.join(" AND "), params };
}

export function filterClause(filter, cutoff) {
  return buildRecipientFilter(null, filter, cutoff).clause;
}

export async function listBroadcastRecipients(db, type, filter, {
  offset = 0,
  limit = 10,
  now = new Date(),
  activityWindowDays = ACTIVE_WINDOW_DAYS,
  extraConditions = [],
} = {}) {
  const cfg = recipientType(type);
  if (!cfg) return [];
  const cutoff = activityCutoff(now, activityWindowDays);
  const { clause, params } = buildRecipientFilter(type, filter, cutoff, { extraConditions });
  const rows = await db.prepare(
    `SELECT ${cfg.columns} FROM ${cfg.table}
     WHERE ${clause} ORDER BY ${cfg.idColumn} LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();
  return (rows.results || []).map(cfg.normalize);
}

export async function countBroadcastRecipients(db, type, filter, {
  now = new Date(),
  activityWindowDays = ACTIVE_WINDOW_DAYS,
  extraConditions = [],
} = {}) {
  const cfg = recipientType(type);
  if (!cfg) return 0;
  const cutoff = activityCutoff(now, activityWindowDays);
  const { clause, params } = buildRecipientFilter(type, filter, cutoff, { extraConditions });
  const stmt = db.prepare(`SELECT COUNT(*) AS c FROM ${cfg.table} WHERE ${clause}`);
  const row = params.length > 0 ? await stmt.bind(...params).first() : await stmt.first();
  return Number(row?.c || 0);
}

