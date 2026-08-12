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
