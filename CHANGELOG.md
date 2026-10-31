# Changelog

All notable changes to HawkBucks Bot are documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows Semantic Versioning where practical.

## [1.2.8] - 2026-10-31

### Fixed
- **Admin Panel Broadcast SQL parameter binding failure (`ADMIN_CALLBACK_FAILED` `bc:filter`).** Resolved a Cloudflare D1 parameter binding mismatch where `countBroadcastRecipients` and `listBroadcastRecipients` bound `cutoff` unconditionally even when the WHERE clause contained 0 placeholders (`all`, `on`, `off`), throwing `D1_ERROR: Wrong number of parameter bindings for SQL query.`. Introduced `buildRecipientFilter()` to dynamically pair SQL WHERE clauses with their exact required parameter bindings (`[]` for `all`, `on`, `off`; `[cutoff]` for `active`, `inactive`).
- **Daily reminder Cron reliability (production incident 2026-09-25).** The scheduled handler previously registered the entire reminder pipeline fire-and-forget inside `ctx.waitUntil()` and returned immediately. The invocation was recorded with `$workers.outcome = "canceled"` while still inside the 15-second delay, so `runDailyReminder()` never executed. Per Cloudflare's Scheduled Handler documentation the runtime waits for the promise **returned by** `scheduled()` (up to the 15-minute duration limit), so the delay and the reminder pipeline are now awaited directly on that promise. This keeps the invocation open for the whole job and makes the recorded Cron outcome (`ok`/`exception`) reflect the real result; reminder failures are rethrown instead of being isolated inside a detached task.
- **D1 reminder run state machine & retention.** Reminder failures no longer delete their `reminder_runs` row: a failed run is retained in D1 as `status = 'failed'` (with `completed_at` set) for diagnosis, while remaining retryable because the acquire path re-claims `failed` rows. A crashed run stuck in `running` beyond the 30-minute stale window is promoted to `failed` instead of being deleted, so crash evidence is preserved.
- **Duplicate reminder delivery protection.** A failure that occurs **after** Telegram messages were already delivered now finalizes the cycle as `completed` (or leaves the `running` lock held if finalization itself fails) instead of releasing it into a retryable state, so a retry can never double-send a cycle that already delivered.
- **Broadcast recipient selection & duplicate prevention.** Enforced server-side validation rejecting empty recipient selection prior to message input, implemented immediate session clearance upon broadcast confirmation to prevent duplicate deliveries on double-click, and handled individual Telegram delivery errors (e.g. 403 Forbidden for blocked bots) gracefully without interrupting the broadcast run.

### Changed
- The intentional 15-second offset now uses the Workers `scheduler.wait()` API instead of `setTimeout`, matching the documented await-able delay mechanism for this runtime (verified against the project's compatibility date `2026-07-25`, including inside the `scheduled` context). The 00:00:15 UTC target is unchanged.
- Reminder-run reservation cleanup (`releasePreparedMissionReminder`) failures are logged without masking the original pipeline error.
- Updated `wrangler` devDependency to `^4.156.0` to match the production deployment toolchain.

### Added
- Scheduler timing instrumentation in `scheduled()`: `CRON_TRIGGER_RECEIVED` now logs `scheduledTime`, `actualTime` and `schedulerDelayMs` (Cloudflare-side lateness), followed by `CRON_DELAY_STARTED`/`CRON_DELAY_FINISHED` (`delayMs`, `waitedMs`) and terminal `CRON_TASK_COMPLETED` (`totalDurationMs`) / `CRON_TASK_FAILED` events, separating scheduler delay from application delay and making interruptions diagnosable by the absence of a terminal event.
- Pipeline observability logs: `MISSION_PREPARATION_STARTED`, `MISSION_IMAGE_CACHE_HIT`/`MISS`/`WAITING`, `MISSION_IMAGE_GENERATION_STARTED`/`COMPLETED`, `MISSION_PREPARATION_FAILED`, plus `sent`/`failed` counts on `CRON_REMINDER_FAILED`.
- Extensible recipient filtering: `buildRecipientFilter`, `listBroadcastRecipients`, and `countBroadcastRecipients` support optional `extraConditions` for dynamic SQL query composition.

### Tests
- Real SQLite test suite (`test/helpers/d1-lite.js`) backed by `node:sqlite` running against `database/schema.sql`.
- Added `test/cron-scheduled.test.js`: Validates awaited lifecycle, scheduler-delay calculation, failure propagation, and ensures no `ctx.waitUntil` regression.
- Added `test/reminder-runs.test.js`: Validates atomic acquisition, retry of failed runs, crash promotion, and row retention against real SQLite.
- Added `test/daily-reminder.test.js`: Validates successful delivery, duplicate cycle skip, pre-delivery failure handling, partial Telegram delivery lock, and reservation release.
- Hardened `test/helpers/fake-db.js`: Validates that SQL `?` placeholder counts strictly match bound argument counts, throwing `D1_ERROR: Wrong number of parameter bindings for SQL query.` on mismatch.
- Extended `test/recipients.test.js`: Tests all 10 Users and Groups filter combinations on real SQLite for both populated and empty tables, verifies placeholder/binding count parity, and tests optional conditions.
- Extended `test/admin-broadcast.test.js`: Tests all 10 filter callbacks, empty recipient progression rejection, duplicate confirmation prevention, and partial delivery failure accounting in `broadcast_history` and admin summary.

## [1.2.6] - 2026-09-18

### Tests
- **Deterministic activity window tests:** Injected explicit reference timestamp parameter (`now`) into `activityCutoff()` and recipient queries so test assertions are anchored to fixed test fixtures rather than the real-time system clock.

## [1.2.5] - 2026-09-18

### Fixed
- Corrected zone-name resolution for Epic zone themes that previously fell through to "Unknown Zone": `ZT_TheForest` now resolves to Forest, and campaign-prefixed zone-theme assets such as `BP_ZT_AD_Lakeside` or `BP_ZT_AD2_TheGrasslands` are normalized to their base zone by stripping the `AD`, `AD2`, and `TRV` campaign prefixes. When no mapping exists, the fallback now surfaces a recognizable identifier ("Unknown Zone (ZT_...)") instead of a bare "Unknown Zone".
- Storm-mission cards now show the correct Atlas-count icon for localized storm titles: the storm category number is extracted generically from "Fight Category N Storm", "Category N Fight The Storm", and "Fight the Storm Category N" variants instead of falling back to the single-Atlas icon.
- The zone ribbon on the mission image now displays the actual number of missions belonging to that zone (for example, Canny Valley with two missions shows 02) instead of the zone's ordinal position in the rendered list. The count is derived from the same grouped mission data used for rendering and is unaffected by zone order or missing zones.

### Changed
- Daily mission/reminder processing now starts at **00:00:15 UTC** instead of 00:00:30 UTC. The architecture is unchanged: the cron trigger still fires at 00:00:00 UTC (`0 0 * * *`) and the scheduled handler applies a fixed 15-second delay inside `ctx.waitUntil`, because Cloudflare cron triggers only support minute granularity.
- Mission images are now rendered at higher quality through ScreenshotOne (`device_scale_factor: 2`, `image_quality: 100`), producing sharper output at twice the pixel density. The PNG format, logical viewport dimensions, HTML/CSS layout, and image-caching behavior are unchanged.

### Tests
- Regression tests for `ZT_TheForest` and campaign-prefixed zone-theme resolution.
- Regression tests for storm-category Atlas icon resolution.
- Regression tests for the ScreenshotOne quality settings (device scale factor 2 and image quality 100 with an unchanged viewport and PNG format) and for per-zone mission-count numbering.
- Reminder-schedule regression tests updated for the 00:00:15 UTC schedule.

### Documentation
- Updated the reminder timing, test overview, and release information in the README.

## [1.2.0] - 2026-09-03

### Added
- Admin Panel "🗄️ Cache Settings" section with "📊 Today's Cached Images" (runs `SELECT COUNT(*) AS image_count FROM mission_images` through the D1 binding) and "🗑️ Delete All Cached Images" (runs `DELETE FROM mission_images` only after an explicit confirmation step, reporting the actual deleted-row count).
- Theater-band validation for mission Power Levels: resolved Power Levels are checked against the valid range of the mission's theater and mismatches are logged instead of being emitted silently.
- Support for group (4-player) mission difficulty rows (`Theater_*_Group_ZoneN`), which share the base rows' Power Levels per tier (verified against raw Epic world-info data and live alert listings).
- Regression tests for Power Level resolution (including the Canny Valley 46→52 correction, group rows, out-of-range/unknown difficulty rows, and per-mission association).
- Regression tests for the Cache Settings flow (count display, zero counts, delete confirmation, D1 error handling, admin-only and private-chat authorization).
- Regression tests for the daily reminder schedule.
- Offline diagnostic tool `scripts/diagnose-power-levels.js` for extracting theater/mission/difficulty-row evidence from a raw Epic world-info payload.

### Changed
- Daily mission/reminder processing now starts at **00:00:30 UTC** instead of 00:05 UTC. The cron trigger fires at 00:00:00 UTC (`0 0 * * *`) and the scheduled handler applies a fixed 30-second delay inside `ctx.waitUntil`, because Cloudflare cron triggers only support minute granularity.
- Mission Power Level resolution now parses `MissionDifficultyInfo.rowName` into (difficulty family, zone index) and resolves it against the current Epic `GameDifficultyGrowthBounds` tier values instead of the stale flat mapping.
- Updated the Canny Valley difficulty tiers to the current live values (46, 52, 58, 64, 70 — the legacy 40–70 six-tier layout no longer exists in live data).
- Missions now carry their raw `difficultyRow` for provenance/debugging.
- The fake D1 test helper now models the `mission_images` table (COUNT with alias preservation and DELETE change counts).

### Fixed
- Corrected V-Buck mission Power Level resolution showing 46 instead of 52 for Canny Valley missions on `Theater_Hard_Zone2` (root cause: stale hardcoded difficulty mapping).

### Documentation
- Documented Cache Settings in the Admin Panel feature list.

## [1.1.1] - 2026-08-30

### Added
- Private administrator-only Admin Panel accessible through the Telegram interface.
- Usage Statistics reports for Today, Current Week, Current Month, Last 6 Months, and Last 12 Months.
- Active Reminders reports covering users, groups, and channels.
- Administrative PDF report generation with branded HawkBucks styling, summary cards, activity tables, pagination, and embedded report fonts.
- Custom broadcast messaging for users and groups with recipient filtering and interactive recipient selection.
- Server-side broadcast recipient revalidation with a 45-recipient limit for the Cloudflare Workers free-plan deployment.
- Persistent `admin_sessions` and `broadcast_history` D1 tables.
- D1 migration `0002_chat_last_seen.sql` for upgrading the v1.0.0 database to the v1.1.x schema.
- Activity tracking through `last_seen` for groups and channels.
- Regression tests covering Admin callbacks, broadcasts, recipient queries, migrations, PDF generation, and production bug fixes.
- Embedded Inter and Sora report-font subsets for PDF generation.

### Changed
- Improved Admin Panel callback routing through the Worker entry point.
- Improved broadcast execution lifecycle using `ctx.waitUntil()` so background delivery continues after the webhook response.
- Refactored broadcast recipient queries to use type-specific SQL projections for users and groups.
- Improved broadcast recipient selection, filtering, pagination, and server-side validation.
- Redesigned administrative PDF reports with a HawkBucks green/forest visual theme.
- Improved PDF text layout, table geometry, vertical alignment, font embedding, Unicode mapping, and pagination.
- Updated D1 schema deployment handling to support idempotent `CREATE` operations and targeted duplicate-object errors.
- Removed migration-only `ALTER TABLE` statements from the main schema so fresh installations can apply `schema.sql` directly.
- Expanded automated validation and regression coverage for deployment-critical behavior.
- Updated repository documentation and project structure documentation for the new Admin Panel and supporting services.

### Fixed
- Fixed Admin Panel inline buttons appearing to freeze because `admin:*` callback queries were not dispatched by the Worker entry point.
- Fixed broadcasts failing because `ctx` was dropped before reaching the background delivery layer.
- Fixed group broadcast recipient queries failing with `D1_ERROR: no such column: username`.
- Fixed broadcast recipient filtering failing because `countBroadcastRecipients` was not imported by the Admin broadcast handler.
- Fixed recipient selection controls and callback index parsing in the broadcast UI.
- Fixed D1 schema deployment failures caused by duplicate `last_seen` column definitions.
- Fixed PDF font embedding corruption that could produce invalid fonts and incorrect text extraction.
- Fixed PDF table/header layout issues caused by inconsistent coordinate and baseline calculations.
- Fixed PDF text operators using the wrong shared Y cursor instead of the calculated per-row/per-line baseline.

### Security
- Replaced legacy hardcoded administrator IDs with secret-based `ADMIN_TELEGRAM_ID` authorization.
- Added private-chat and server-side authorization checks for Admin Panel callbacks.
- Added server-side recipient-limit enforcement and revalidation for broadcasts.
- Kept broadcast history metadata-only; broadcast message content is not stored.
- Added safeguards and regression tests preventing accidental exposure of administrative credentials or hardcoded administrator IDs.
- Production D1 migration remains non-destructive: only required columns and tables are added.

### Known Limitations
- Custom broadcasts are limited to 45 recipients in the current free-plan implementation.
- Telegram channels are excluded from custom broadcasts because they receive the scheduled daily reminder automatically.
- Persian/Arabic text in administrative PDFs remains limited because the lightweight PDF renderer does not currently provide Arabic glyph coverage and shaping support.
- Broadcast handling currently performs a single retry for Telegram `429` responses.
- Secondary database indexes for activity/reminder filters have not been added because current recipient volumes do not require them.

## [1.1.0] - 2026-08-30

### Added
- Initial production Admin Panel implementation.
- Administrator-only access through `ADMIN_TELEGRAM_ID`.
- Usage Statistics and Active Reminders administrative views.
- Custom broadcast workflow with recipient filtering and selection.
- Persistent Admin Panel sessions and broadcast history.
- Group and channel activity tracking through `last_seen`.
- Initial administrative PDF reporting support.
- Additional automated tests for administrative functionality and D1 schema changes.

### Changed
- Expanded the private Telegram interface with an Admin entry point for the configured administrator.
- Added D1 schema support for the new administrative features.
- Extended database access and service layers for recipient discovery, statistics, broadcasts, and PDF reports.

### Security
- Removed legacy hardcoded owner-ID authorization in favor of a configured administrator secret.
- Added server-side authorization for administrative actions and private-chat-only restrictions.

## [0.1.0] - 2026-08-12

### Added
- Initial documented HawkBucks Bot release baseline.
- Telegram bot integration.
- Fortnite: Save the World V-Bucks mission processing pipeline.
- Multiple mission-source integrations.
- Cloudflare Workers runtime.
- Cloudflare D1 persistence.
- Daily reminder workflow.
- Mission image generation and caching.
- Automated testing foundation.

[Unreleased]: https://github.com/Greenhawk5/HawkBucks-Bot/compare/v1.2.8...HEAD
[1.2.8]: https://github.com/Greenhawk5/HawkBucks-Bot/compare/v1.2.6...v1.2.8
[1.2.6]: https://github.com/Greenhawk5/HawkBucks-Bot/compare/v1.2.5...v1.2.6
[1.2.5]: https://github.com/Greenhawk5/HawkBucks-Bot/compare/v1.2.0...v1.2.5
[1.2.0]: https://github.com/Greenhawk5/HawkBucks-Bot/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/Greenhawk5/HawkBucks-Bot/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Greenhawk5/HawkBucks-Bot/compare/v0.1.0...v1.1.0
[0.1.0]: https://github.com/Greenhawk5/HawkBucks-Bot/releases/tag/v0.1.0
