export async function getReminderRecipients(db) {
  const [users, groups, channels] = await Promise.all([
    db.prepare("SELECT telegram_id FROM users WHERE reminder_enabled = 1").all(),
    db.prepare("SELECT id FROM groups WHERE reminder_enabled = 1").all(),
    db.prepare("SELECT id FROM channels WHERE reminder_enabled = 1").all(),
  ]);

  return [
    ...(users.results || []).map((row) => ({ type: "user", chatId: row.telegram_id })),
    ...(groups.results || []).map((row) => ({ type: "group", chatId: row.id })),
    ...(channels.results || []).map((row) => ({ type: "channel", chatId: row.id })),
  ];
}
