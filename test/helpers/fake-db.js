// In-memory D1 stub sufficient for the admin modules' queries.
// Implements prepare(sql).bind(...args).first()/.all()/.run() semantics for
// the specific SQL shapes used by database/stats.js, recipients.js,
// admin-sessions.js and broadcasts.js.

// Fake D1. Handles the SQL shapes used by the admin modules:
// - alias mapping ("telegram_id AS id")
// - parameterized and datetime('now', ...) date filters
// - LIMIT ? OFFSET ? pagination
const ACTIVE_WINDOW_DAYS = 7;

function d1Timestamp(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function rowMatches(where, row, args) {
  if (!where || /^1=1/i.test(where.trim())) return true;
  if (/reminder_enabled\s*=\s*\?/.test(where)) return Number(row.reminder_enabled) === args[0];
  if (/reminder_enabled\s*=\s*1/.test(where)) return Number(row.reminder_enabled) === 1;
  if (/reminder_enabled\s*=\s*0/.test(where)) return Number(row.reminder_enabled) === 0;
  if (/last_seen\s*>=\s*\?/.test(where)) return Boolean(row.last_seen) && row.last_seen >= args[0];
  if (/last_seen\s*>=\s*datetime\('now',\s*'-7 days'\)/.test(where)) {
    if (!row.last_seen) return false;
    return row.last_seen >= d1Timestamp(new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400000));
  }
  if (/last_seen\s*<\s*datetime\('now',\s*'-7 days'\)/.test(where)) {
    if (!row.last_seen) return true;
    return row.last_seen < d1Timestamp(new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400000));
  }
  if (/last_seen\s*>=\s*\?/.test(where)) return row.last_seen >= args[0];
  const inMatch = where.match(/([a-z_]+)\s+IN\s*\(/i);
  if (inMatch) return args.map(String).includes(String(row[inMatch[1]]));
  return true;
}


export function createFakeDb(tables = {}) {
  const state = {
    users: tables.users || [],
    groups: tables.groups || [],
    channels: tables.channels || [],
    admin_sessions: tables.admin_sessions || [],
    broadcast_history: tables.broadcast_history || [],
    mission_images: tables.mission_images || [],
  };
  const stateJsonWrites = [];
  const sqlLog = [];

  async function execute(sql, args) {
    const s = sql.replace(/\s+/g, " ").trim();
    const lower = s.toLowerCase();

    if (lower.startsWith("select")) {
      for (const [name, rows] of Object.entries(state)) {
        const m = s.match(new RegExp(`from ${name}\\b`, "i"));
        if (!m) continue;
        const whereMatch = s.match(/where\s+([\s\S]*)/i);
        const whereRaw = whereMatch ? whereMatch[1] : "";
        const where = whereRaw.replace(/\s+order by.*$/i, "");
        let limitOverride = 10;
        let offsetOverride = 0;
        const filtered = rows.filter((r) => rowMatches(where, r, args || []));

        if (/expires_at\s*>\s*\?/.test(where)) {
          const current = rows.find((r) => String(r.chat_id) === String(args?.[0]));
          if (!current || Number(current.expires_at) <= (args?.[1] ?? 0)) return { results: [], meta: { changes: 0 } };
          return { ...current };
        }

        if (/count\(\*\)/i.test(s)) {
          const alias = s.match(/count\(\*\)\s+as\s+(\w+)/i)?.[1] || "c";
          return { [alias]: filtered.length };
        }

        // Alias mapping for projections like "telegram_id AS id, first_name AS label".
        const aliases = [...s.matchAll(/([a-z_]+)\s+AS\s+([a-z_]+)/gi)].map(([, src, dst]) => [src, dst]);
        let projected;
        if (aliases.length) {
          projected = filtered.map((r) => Object.fromEntries(aliases.map(([src, dst]) => [dst, r[src] ?? null])));
        } else {
          projected = filtered.map((r) => ({ ...r }));
        }

        // LIMIT/OFFSET apply only when the query actually specifies them.
        if (/offset\s+\?/i.test(whereRaw) && args && args.length >= 2) {
          offsetOverride = args[args.length - 1];
          limitOverride = args[args.length - 2];
        } else if (/limit\s+\?/i.test(whereRaw) && args && args.length) {
          limitOverride = args[args.length - 1];
        }
        const limit = /limit\s+\?/i.test(whereRaw) ? limitOverride : Infinity;
        const offset = /offset\s+\?/i.test(whereRaw) ? offsetOverride : 0;
        return { results: projected.slice(offset, offset + limit), meta: { changes: 0 } };
      }
      return { results: [], meta: { changes: 0 } };
    }

    if (lower.startsWith("insert") || lower.startsWith("replace")) {
      if (s.includes("admin_sessions")) {
        stateJsonWrites.push(args);
        const [chatId, stateJson, expiresAt] = args;
        const idx = state.admin_sessions.findIndex((r) => r.chat_id === chatId);
        const row = { chat_id: chatId, state_json: stateJson, expires_at: expiresAt };
        if (idx >= 0) state.admin_sessions[idx] = row;
        else state.admin_sessions.push(row);
        return { meta: { changes: 1 } };
      }
      if (s.includes("broadcast_history")) {
        state.broadcast_history.push({
          id: args[0], admin_id: args[1],
          recipient_count: args[2], success_count: args[3], failed_count: args[4],
        });
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }

    if (lower.startsWith("update")) {
      if (s.includes("admin_sessions")) return { meta: { changes: 0 } };
      return { meta: { changes: 0 } };
    }

    if (lower.startsWith("delete")) {
      if (s.includes("admin_sessions")) {
        state.admin_sessions = state.admin_sessions.filter((r) => r.chat_id !== args?.[0]);
        return { meta: { changes: 1 } };
      }
      if (s.includes("mission_images")) {
        const before = state.mission_images.length;
        const whereMatch = s.match(/where\s+([\s\S]*)/i);
        state.mission_images = whereMatch
          ? state.mission_images.filter((r) => !rowMatches(whereMatch[1].replace(/\s+order by.*$/i, ""), r, args || []))
          : [];
        return { meta: { changes: before - state.mission_images.length } };
      }
      return { meta: { changes: 0 } };
    }

    return { meta: { changes: 0 } };
  }

  return {
    state,
    stateJsonWrites,
    sqlLog,
    prepare(sql) {
      sqlLog.push(sql);
      let boundArgs = [];
      return {
        bind(...args) { boundArgs = args; return this; },
        first() { return execute(sql, boundArgs).then((r) => (r.results ? r.results[0] ?? null : r)); },
        all() { return execute(sql, boundArgs); },
        run() { return execute(sql, boundArgs); },
      };
    },
  };
}

export const ADMIN_ID = "111222333";

export const adminEnv = () => ({ ADMIN_TELEGRAM_ID: ADMIN_ID });

export const sampleUsers = [
  { telegram_id: "1", username: "alice", first_name: "Alice", reminder_enabled: 1, last_seen: "2026-08-29 10:00:00" },
  { telegram_id: "2", username: "bob", first_name: "Bob", reminder_enabled: 0, last_seen: "2026-08-01 10:00:00" },
  { telegram_id: "3", username: null, first_name: "Carol", reminder_enabled: 1, last_seen: "2026-08-28 09:00:00" },
  { telegram_id: "4", username: "dave", first_name: "Dave", reminder_enabled: 1, last_seen: null },
];

export const sampleGroups = [
  { id: "-100111", title: "Group One", type: "supergroup", reminder_enabled: 1, last_seen: "2026-08-29 08:00:00" },
  { id: "-100222", title: "Group Two", type: "group", reminder_enabled: 0, last_seen: "2026-08-20 08:00:00" },
];

export const sampleChannels = [
  { id: "-100333", title: "Channel One", type: "channel", reminder_enabled: 1, last_seen: "2026-08-29 07:00:00" },
];
