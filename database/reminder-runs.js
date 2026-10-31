/**
 * Duplicate-run protection for the daily reminder cycle (D1 table
 * `reminder_runs`, keyed by the cycle key from getReminderCycleKey()).
 *
 * State machine per cycle key:
 *   (absent)    --acquire-->  running
 *   running     --complete->  completed   (terminal: the cycle can never run again)
 *   running     --release---> failed      (terminal-until-retried: failure is kept
 *                                          visible in D1 and the cycle is retryable)
 *   running (stuck > 30 min, crashed/canceled invocation)
 *               --acquire---> failed      (promoted, NOT deleted — evidence retained)
 *   failed      --acquire---> running     (re-claim for a retry)
 *
 * No row is ever deleted (the previous implementation removed failed/crashed
 * rows, destroying the only evidence), so reminder_runs remains queryable for
 * diagnosis after the fact. Only one invocation can hold `running` for a cycle
 * key at a time, because acquireReminderRun() resolves to a single atomic
 * INSERT ... ON CONFLICT statement whose changes count decides ownership.
 */

const STALE_RUN_MINUTES = 30;

export async function acquireReminderRun(db, cycleKey) {
  // 1. A 'running' row older than the stale window belongs to a crashed or
  //    canceled invocation. Promote it to 'failed' (kept for diagnosis) so the
  //    cycle becomes retryable instead of silently deleting the evidence.
  await db.prepare(`
    UPDATE reminder_runs
    SET status = 'failed', completed_at = CURRENT_TIMESTAMP
    WHERE cycle_key = ?
      AND status = 'running'
      AND started_at < datetime('now', ?)
  `).bind(cycleKey, `-${STALE_RUN_MINUTES} minutes`).run();

  // 2. Atomically claim the cycle: insert on first attempt, or re-claim a row
  //    that previously failed. Conflicts with 'completed' rows (never re-run)
  //    and fresh 'running' rows (lock held) report 0 changed rows, so exactly
  //    one invocation can ever own the cycle.
  const result = await db.prepare(`
    INSERT INTO reminder_runs (cycle_key, status)
    VALUES (?, 'running')
    ON CONFLICT(cycle_key) DO UPDATE SET status = 'running',
      started_at = CURRENT_TIMESTAMP, completed_at = NULL
    WHERE status = 'failed'
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

/**
 * Marks a run that failed before delivering anything as 'failed' instead of
 * deleting the row: the failure stays observable in D1 (status + completed_at)
 * while remaining retryable, because acquireReminderRun() re-claims 'failed'
 * rows. Never called after a successful send — see runDailyReminder(), which
 * finalizes partially delivered cycles as 'completed' to prevent duplicates.
 */
export async function releaseReminderRun(db, cycleKey) {
  await db.prepare(`
    UPDATE reminder_runs
    SET status = 'failed', completed_at = CURRENT_TIMESTAMP
    WHERE cycle_key = ? AND status = 'running'
  `).bind(cycleKey).run();
}
