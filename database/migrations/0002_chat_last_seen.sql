-- Migration: upgrade a v1.0.0 production database to the v1.1.0 schema.
--
-- Applies:
--   1. groups.last_seen / channels.last_seen activity tracking
--      (users already had last_seen in v1.0.0)
--   2. admin_sessions  (Admin Panel multi-step state, e.g. broadcast flow)
--   3. broadcast_history (metadata-only broadcast audit trail)
--
-- Non-destructive: only ADD COLUMN and CREATE TABLE IF NOT EXISTS.
-- Existing rows in users/groups/channels are preserved.
--
-- Note: SQLite has no "ADD COLUMN IF NOT EXISTS"; re-running this migration
-- on an already-upgraded database raises "duplicate column", which the
-- deployment script recognizes and skips (see scripts/deploy-d1-schema.js).
ALTER TABLE groups ADD COLUMN last_seen DATETIME;
ALTER TABLE channels ADD COLUMN last_seen DATETIME;

CREATE TABLE IF NOT EXISTS admin_sessions (
    chat_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS broadcast_history (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recipient_count INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    failed_count INTEGER NOT NULL
);
