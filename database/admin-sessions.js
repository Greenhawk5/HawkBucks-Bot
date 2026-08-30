// Server-side state for multi-step admin interactions.
// Rows are scoped to the admin's chat ID and expire; every consumer must
// re-verify admin authorization — the session alone grants nothing.

const TTL_SECONDS = 30 * 60;

export async function getAdminSession(db, chatId) {
  const row = await db.prepare(
    "SELECT chat_id, state_json, expires_at FROM admin_sessions WHERE chat_id = ? AND expires_at > ?"
  ).bind(String(chatId), Math.floor(Date.now() / 1000)).first();
  if (!row) return null;
  try {
    return JSON.parse(row.state_json);
  } catch {
    await deleteAdminSession(db, chatId);
    return null;
  }
}

export async function setAdminSession(db, chatId, state) {
  await db.prepare(`
    INSERT INTO admin_sessions (chat_id, state_json, updated_at, expires_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = CURRENT_TIMESTAMP,
      expires_at = excluded.expires_at
  `).bind(String(chatId), JSON.stringify(state), Math.floor(Date.now() / 1000) + TTL_SECONDS).run();
}

export async function deleteAdminSession(db, chatId) {
  await db.prepare("DELETE FROM admin_sessions WHERE chat_id = ?")
    .bind(String(chatId)).run();
}
