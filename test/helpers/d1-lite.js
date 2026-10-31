// Minimal D1-compatible adapter backed by real SQLite (node:sqlite), so the
// reminder tests execute the exact SQL that runs in production D1 instead of
// pattern-matched fakes. Loads the real database/schema.sql.
//
// D1 API surface used by the reminder pipeline:
//   db.prepare(sql).bind(...args).all()   -> { results: [...] }
//   db.prepare(sql).bind(...args).first() -> row | null
//   db.prepare(sql).bind(...args).run()   -> { meta: { changes: number } }
//
// `intercept` (optional) receives (sql, args) before execution and may throw
// to simulate a D1 outage on specific statements.

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const SCHEMA_PATH = new URL("../../database/schema.sql", import.meta.url);

export function createD1({ intercept } = {}) {
  const raw = new DatabaseSync(":memory:");
  raw.exec(readFileSync(SCHEMA_PATH, "utf8"));

  return {
    raw,
    prepare(sql) {
      let boundArgs = [];
      const statement = {
        bind(...args) {
          boundArgs = args;
          return statement;
        },
        async all() {
          intercept?.(sql, boundArgs);
          return { results: raw.prepare(sql).all(...boundArgs), meta: { changes: 0 } };
        },
        async first() {
          intercept?.(sql, boundArgs);
          return raw.prepare(sql).get(...boundArgs) ?? null;
        },
        async run() {
          intercept?.(sql, boundArgs);
          const result = raw.prepare(sql).run(...boundArgs);
          return { meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
  };
}

/** Direct read helper for assertions: returns all rows for a query. */
export function queryAll(db, sql, ...args) {
  return db.raw.prepare(sql).all(...args);
}
