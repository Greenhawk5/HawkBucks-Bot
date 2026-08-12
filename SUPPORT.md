# Support

## Before Asking for Help

Please check:

1. `README.md`
2. Existing GitHub Issues
3. Recent Pull Requests
4. `CONTRIBUTING.md`
5. `SECURITY.md` if the problem may involve credentials or security

## Bug Reports

When reporting a reproducible bug, include:

- What you were trying to do.
- What happened.
- What you expected to happen.
- Steps to reproduce the problem.
- Relevant error messages.
- Relevant non-sensitive logs.
- Whether the issue affects private chats, groups, channels, reminders,
  mission processing, rendering, or deployment.

A minimal reproducible example is strongly preferred.

## Environment Information

When useful, include:

- Node.js version
- npm version
- Wrangler version
- Deployment environment
- Relevant package version information

Do not include:

- Telegram bot tokens,
- API keys,
- Cloudflare credentials,
- private webhook URLs,
- private user information,
- unredacted production secrets.

## Mission Data Problems

If a mission appears incorrect, provide:

- Mission date/rotation.
- Mission area or zone.
- Expected result.
- Observed result.
- Source involved, if known.

Mission-source failures may originate upstream, so identifying the source and
time of the failure is useful.

## Reminder Problems

For reminder issues, specify whether the problem occurred with:

- A private user reminder.
- A group reminder.
- A channel reminder.
- Manual `/vbuck` execution.
- The scheduled daily reminder.

If possible, include the approximate execution time and relevant non-sensitive
logs.

## Deployment Problems

For deployment issues, include:

- The command used.
- The relevant error message.
- Whether the issue occurs locally or only after deployment.
- Whether D1 schema changes were involved.
- Whether `scripts/validate-deployment.js` passes.

Never paste secret values into an issue.

## Feature Requests

Feature requests are welcome when they include:

- The problem being solved.
- The proposed behavior.
- Why the feature would be useful.
- Any relevant Telegram UX considerations.

Keep feature requests focused so they can be evaluated independently.

## Security Issues

Do not open a public issue for a security vulnerability.

Follow `SECURITY.md` instead.

## Getting Help

GitHub Issues are the preferred place for reproducible bugs and project-specific
feature discussions.

For general questions, provide enough context for another developer to reproduce
or understand the situation without access to private infrastructure.
