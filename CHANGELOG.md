# Changelog

All notable changes to HawkBucks Bot are documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows Semantic Versioning where practical.

## [Unreleased]

### Added
- Future improvements and maintenance changes will be documented here.

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

[Unreleased]: https://github.com/Greenhawk5/HawkBucks-Bot/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/Greenhawk5/HawkBucks-Bot/releases/tag/v1.1.1
[1.1.0]: https://github.com/Greenhawk5/HawkBucks-Bot/releases/tag/v1.1.0
[0.1.0]: https://github.com/Greenhawk5/HawkBucks-Bot/releases/tag/v0.1.0
