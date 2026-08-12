const STALE_RUN_MINUTES = 30;

export async function acquireReminderRun(db, cycleKey) {
  await db.prepare(`
    DELETE FROM reminder_runs
    WHERE cycle_key = ?
      AND status = 'running'
      AND started_at < datetime('now', ?)
  `).bind(cycleKey, `-${STALE_RUN_MINUTES} minutes`).run();

  const result = await db.prepare(`
    INSERT INTO reminder_runs (cycle_key, status)
    VALUES (?, 'running')
    ON CONFLICT(cycle_key) DO NOTHING
  `).bind(cycleKey).run();

  return result.meta.changes === 1;
}

export async function completeReminderRun(db, cycleKey) {
  await db.prepare(`
    UPDATE reminder_runs
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE cycle_key = ?
  `).bind(cycleKey).run();
}

export async function releaseReminderRun(db, cycleKey) {
  await db.prepare("DELETE FROM reminder_runs WHERE cycle_key = ? AND status = 'running'")
    .bind(cycleKey)
    .run();
}
