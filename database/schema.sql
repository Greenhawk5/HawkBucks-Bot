CREATE TABLE IF NOT EXISTS users (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    telegram_id TEXT UNIQUE NOT NULL,

    username TEXT,

    first_name TEXT,

    role TEXT DEFAULT 'USER',

    reminder_enabled INTEGER NOT NULL DEFAULT 1,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS mission_images (

    date TEXT PRIMARY KEY NOT NULL,

    telegram_file_id TEXT,

    missions_json TEXT,

    status TEXT NOT NULL DEFAULT 'generating',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    title TEXT,
    type TEXT NOT NULL,
    reminder_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    title TEXT,
    type TEXT NOT NULL DEFAULT 'channel',
    reminder_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS panel_sessions (
    message_id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    opened_by TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_runs (
    cycle_key TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);
