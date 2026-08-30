# Repository Hardening

This document defines the baseline security practices for the HawkBucks Bot
repository.

The goal is to keep source control clean, prevent accidental secret exposure,
and reduce avoidable production risk.

## 1. Secrets

Never commit:

- Telegram bot tokens
- API keys
- Screenshot-generation credentials
- Cloudflare credentials
- Database credentials
- Webhook secrets
- `.env` or `.dev.vars` files containing real secrets
- Personal access tokens
- Private authentication material

Secrets belong in Cloudflare secrets/environment configuration or local
development files that are excluded from Git.

If a secret is committed, assume it is compromised.

## 2. Git Ignore Rules

The repository should exclude local/generated content such as:

- `node_modules/`
- `.wrangler/`
- local environment files
- test/runtime caches
- operating-system metadata
- editor-specific temporary files

Review `.gitignore` whenever a new local tool or generated directory is added.

## 3. Review Before Commit

Before committing:

```bash
git status
git diff --cached
```

Review the complete staged diff and verify that it contains:

- only intended files,
- no credentials,
- no local databases,
- no generated caches,
- no private logs,
- no unrelated changes.

## 4. Dependency Hygiene

Keep dependencies intentional and up to date.

When updating dependencies:

- review the changelog,
- check for breaking changes,
- run tests,
- run deployment validation,
- inspect the lockfile diff.

Do not add a dependency for functionality that can be implemented safely and
clearly without it.

## 5. Cloudflare Configuration

Review `wrangler.jsonc` carefully before deployment.

Production configuration should not contain hard-coded secret values.

Bindings, Cron configuration, compatibility settings, observability, and D1
configuration should be reviewed whenever deployment behavior changes.

## 6. Telegram Security

Do not log or expose:

- bot tokens,
- authorization headers,
- private webhook secrets,
- unnecessary personal user information.

When debugging Telegram interactions, redact sensitive values from logs and
screenshots.

## 7. Database Security

Use parameterized database operations.

Avoid exposing unnecessary user, group, or channel data in logs.

Database schema changes should be reviewed together with the affected access
code and deployment process.

## 8. External Services

Treat external mission sources and rendering services as untrusted boundaries.

Validate external responses before using them.

Handle:

- missing fields,
- unexpected formats,
- failed requests,
- timeouts,
- partial data,
- upstream changes.

Do not assume external HTML or API responses will remain unchanged.

## 9. Deployment Validation

Run repository validation before production deployment:

```bash
node scripts/validate-deployment.js
```

Also run the test suite:

```bash
npm test
```

## 10. GitHub Repository Settings

Recommended repository protections include:

- Protecting the `main` branch.
- Requiring Pull Requests for normal changes.
- Requiring status checks before merge when CI is configured.
- Restricting force pushes to `main`.
- Restricting branch deletion.
- Enabling Dependabot security updates where available.
- Reviewing repository Actions permissions.
- Reviewing secret and variable access regularly.

## 11. Incident Response

If a credential is exposed:

1. Revoke or rotate it immediately.
2. Identify where it was exposed.
3. Remove it from the current source tree.
4. Check whether it exists in Git history.
5. Rotate any related credentials.
6. Review deployment logs and access logs where applicable.
7. Document the incident privately.

Deleting a secret from the latest commit does not necessarily remove it from
Git history.

## 12. Security Baseline

A repository change should not be considered complete if it introduces:

- a new hard-coded credential,
- an unnecessary public endpoint,
- sensitive logging,
- unsafe database input handling,
- unvalidated external data,
- undocumented production configuration.

Security is part of the implementation, not a final cleanup step.

## 13. Admin / D1 / Broadcast Notes (v1.1.x)

The v1.1.x series introduced an Admin Panel and related persistence and
delivery changes. Include the following review points when preparing a
release or validating production configuration:

- Legacy hardcoded administrator IDs have been removed. Administrative access
	is now authorized exclusively via the `ADMIN_TELEGRAM_ID` Cloudflare Worker
	Secret. Never commit real administrator IDs to the repository.
- D1 schema additions include `admin_sessions` and `broadcast_history`. These
	tables persist session and broadcast metadata; they do not contain message
	bodies or secret values.
- Broadcast delivery is validated server-side, enforces a hard cap of 45
	recipients per broadcast, and uses `ctx.waitUntil()` to perform background
	delivery. The recipient list is resolved from D1 at send time and client
	inputs are not treated as authoritative.
- A migration file `database/migrations/0002_chat_last_seen.sql` upgrades the
	v1.0.0 schema to include `groups.last_seen` and `channels.last_seen`. For
	production upgrades run the explicit remote migration command documented
	in the release notes rather than running ad-hoc migrations inside request
	handlers.

## 14. Secret handling reminder

- Use `npx wrangler secret put ADMIN_TELEGRAM_ID` or the Cloudflare dashboard to
	provision the admin secret. Example development placeholders may appear in
	`.env.example` but should never be replaced with real values in tracked
	files.
