// Metadata-only broadcast audit trail. Message content is intentionally NOT
// stored (privacy/storage); only counts and the acting administrator ID.

export async function recordBroadcast(db, { id, adminId, recipientCount, successCount, failedCount }) {
  await db.prepare(`
    INSERT INTO broadcast_history (id, admin_id, recipient_count, success_count, failed_count)
    VALUES (?, ?, ?, ?, ?)
  `).bind(String(id), String(adminId), recipientCount, successCount, failedCount).run();
}

export async function listBroadcastHistory(db, limit = 10) {
  const rows = await db.prepare(
    "SELECT id, admin_id, created_at, recipient_count, success_count, failed_count FROM broadcast_history ORDER BY created_at DESC LIMIT ?"
  ).bind(limit).all();
  return rows.results || [];
}
