async function upsertChat(db, table, chat) {
  await db.prepare(`
    INSERT INTO ${table} (id, title, type, reminder_enabled)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, type = excluded.type
  `).bind(String(chat.id), chat.title || null, chat.type).run();
}

export function upsertGroup(db, chat) {
  return upsertChat(db, "groups", chat);
}

export function upsertChannel(db, chat) {
  return upsertChat(db, "channels", { ...chat, type: "channel" });
}

export function deleteGroup(db, chatId) {
  return db.prepare("DELETE FROM groups WHERE id = ?").bind(String(chatId)).run();
}

export function deleteChannel(db, chatId) {
  return db.prepare("DELETE FROM channels WHERE id = ?").bind(String(chatId)).run();
}

export async function getReminderStatus(db, chatId) {
  const id = String(chatId);
  const group = await db.prepare("SELECT reminder_enabled FROM groups WHERE id = ?").bind(id).first();
  if (group) return Number(group.reminder_enabled) === 1;
  const channel = await db.prepare("SELECT reminder_enabled FROM channels WHERE id = ?").bind(id).first();
  return channel ? Number(channel.reminder_enabled) === 1 : null;
}

async function setReminder(db, table, chatId, enabled) {
  await db.prepare(`UPDATE ${table} SET reminder_enabled = ? WHERE id = ?`)
    .bind(enabled ? 1 : 0, String(chatId)).run();
}

export function enableGroupReminder(db, chatId) { return setReminder(db, "groups", chatId, true); }
export function disableGroupReminder(db, chatId) { return setReminder(db, "groups", chatId, false); }
export function enableChannelReminder(db, chatId) { return setReminder(db, "channels", chatId, true); }
export function disableChannelReminder(db, chatId) { return setReminder(db, "channels", chatId, false); }

export async function createPanelSession(db, { messageId, chatId, openedBy, expiresAt }) {
  await db.prepare(`
    INSERT OR REPLACE INTO panel_sessions (message_id, chat_id, opened_by, expires_at)
    VALUES (?, ?, ?, ?)
  `).bind(String(messageId), String(chatId), String(openedBy), expiresAt).run();
}

export async function getPanelSession(db, messageId) {
  const session = await db.prepare(
    "SELECT * FROM panel_sessions WHERE message_id = ? AND expires_at > ?"
  ).bind(String(messageId), Math.floor(Date.now() / 1000)).first();
  return session || null;
}

export async function getPanelSessionForCleanup(db, messageId) {
  return db.prepare("SELECT * FROM panel_sessions WHERE message_id = ?")
    .bind(String(messageId))
    .first();
}

export function deletePanelSession(db, messageId) {
  return db.prepare("DELETE FROM panel_sessions WHERE message_id = ?").bind(String(messageId)).run();
}

export function refreshPanelSession(db, messageId, expiresAt) {
  return db.prepare("UPDATE panel_sessions SET expires_at = ? WHERE message_id = ?")
    .bind(expiresAt, String(messageId))
    .run();
}
