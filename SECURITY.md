# Security Policy

## Supported Versions

Security fixes are generally applied to the current development baseline.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older releases | Best effort |

Because HawkBucks Bot is an actively evolving project, users should prefer the
latest available release or commit.

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub Issues.

A security report should privately describe:

- The affected component.
- The vulnerability.
- Steps to reproduce it.
- Potential impact.
- Any proof-of-concept material that is safe to share.
- Suggested remediation, if known.

If private GitHub security reporting is enabled for the repository, use that
mechanism. Otherwise, contact the project maintainer through the private contact
method associated with the repository.

## Sensitive Information

Never include the following in a security report:

- Active Telegram bot tokens.
- API keys.
- Cloudflare credentials.
- ScreenshotOne credentials.
- Private user data.
- Unredacted production logs.

If you accidentally expose a credential, rotate/revoke it immediately and then
report the exposure privately.

## Response Process

Security reports will be reviewed as soon as practical.

Depending on severity, the response may include:

1. Reproducing and validating the issue.
2. Assessing affected components.
3. Rotating exposed credentials where necessary.
4. Preparing and testing a fix.
5. Releasing the fix.
6. Documenting the issue after remediation when appropriate.

## Scope

Security concerns may include:

- Secret or credential exposure.
- Telegram webhook or authentication weaknesses.
- Unauthorized access to bot functionality.
- Unsafe handling of user/group/channel data.
- D1 access vulnerabilities.
- Injection vulnerabilities.
- Unsafe external-data processing.
- Cloudflare deployment/configuration weaknesses.
- Public endpoints that expose sensitive operations.

## Admin Panel & Secrets

- The Admin Panel is protected by a single Cloudflare Worker secret: `ADMIN_TELEGRAM_ID`.
	This secret must be provisioned via `npx wrangler secret put ADMIN_TELEGRAM_ID` (or the
	Cloudflare dashboard) and must never be committed into source control.
- The Worker configuration **fails closed** for admin features: if `ADMIN_TELEGRAM_ID`
	is missing or invalid, administrator-only features are disabled and `isAdmin()`
	will return false for all requests. Do not rely on client-side visibility for
	security (Telegram UI is not a security boundary).
- Every incoming admin callback is re-validated server-side against the configured
	secret and is only accepted from private chats. Callback payloads are not
	trusted to identify administrator intent — the sender is always rechecked.

## Broadcasts and Recipient Handling

- Broadcast delivery is performed server-side and uses `ctx.waitUntil()` for
	background deliveries. The code enforces a server-side maximum recipient cap
	(45 recipients) — this limit is authoritative and cannot be bypassed from the
	client/UI.
- Recipient identifiers are resolved from the D1 database at send-time; callback
	or client-provided recipient data is not trusted as the canonical source of
	truth.
- Broadcast history (`broadcast_history`) stores delivery metadata only (status,
	recipient id, timestamps) and does not retain message content or secrets.

## Logging and Secrets

- Do not log the value of `ADMIN_TELEGRAM_ID` or any other secret. The code
	intentionally logs only non-sensitive configuration flags (for example,
	`ADMIN_CONFIG_INVALID: { configured: false }`) when the admin secret is
	missing or malformed.
- If a secret is exposed, rotate/revoke it immediately and follow incident
	response procedures in this document.

## Safe Harbor

Good-faith security research intended to identify and responsibly report
vulnerabilities is welcome.

Please avoid:

- accessing data that does not belong to you,
- disrupting production services,
- destructive testing,
- spam,
- denial-of-service activity,
- social engineering of users or service providers.

Stop testing and report the issue once sufficient evidence has been collected.
