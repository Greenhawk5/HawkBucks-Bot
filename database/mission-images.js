export async function getMissionImage(db, date) {
  if (!db) return null;
  return db.prepare("SELECT date, telegram_file_id, missions_json, status, created_at FROM mission_images WHERE date = ?")
    .bind(date)
    .first();
}

export async function reserveMissionImage(db, date) {
  if (!db) return true;
  // A terminated request must not leave a date locked forever.
  await db.prepare("DELETE FROM mission_images WHERE date = ? AND status = 'generating' AND created_at < datetime('now', '-10 minutes')")
    .bind(date)
    .run();
  const result = await db.prepare("INSERT INTO mission_images (date, status) VALUES (?, 'generating') ON CONFLICT(date) DO NOTHING")
    .bind(date)
    .run();
  return result.meta.changes === 1;
}

export async function storeMissionImage(db, { date, telegramFileId, missions }) {
  if (!db) return;
  await cleanupMissionImages(db, date);
  await db.prepare(`
    INSERT INTO mission_images (date, telegram_file_id, missions_json, status, created_at)
    VALUES (?, ?, ?, 'ready', CURRENT_TIMESTAMP)
    ON CONFLICT(date) DO UPDATE SET telegram_file_id = excluded.telegram_file_id,
      missions_json = excluded.missions_json, status = 'ready', created_at = CURRENT_TIMESTAMP
  `).bind(date, telegramFileId, JSON.stringify(missions)).run();
  console.log("IMAGE_CACHE_STORED", { date });
}

export async function cleanupMissionImages(db, preserveDate = null) {
  if (!db) return;
  console.log("IMAGE_CACHE_CLEANUP_STARTED", { preserveDate });
  const query = preserveDate
    ? "DELETE FROM mission_images WHERE date <> ?"
    : "DELETE FROM mission_images";
  const result = preserveDate
    ? await db.prepare(query).bind(preserveDate).run()
    : await db.prepare(query).run();
  console.log("IMAGE_CACHE_DELETED", { count: result?.meta?.changes || 0 });
}

export async function releaseMissionImageReservation(db, date) {
  if (!db) return;
  await db.prepare("DELETE FROM mission_images WHERE date = ? AND status = 'generating'").bind(date).run();
}
