# Contributing to HawkBucks Bot

Thank you for your interest in improving HawkBucks Bot.

The project is intentionally modular, so contributions should normally stay
focused on one area such as mission processing, Telegram interactions,
rendering, persistence, scheduled jobs, testing, or deployment tooling.

## Before You Start

Please:

1. Read the `README.md`.
2. Check existing Issues and Pull Requests before opening a new one.
3. For security concerns, read `SECURITY.md` and do not disclose secrets publicly.
4. Keep unrelated refactoring out of feature or bug-fix changes.

## Development Setup

Requirements:

- Git
- Node.js
- npm
- Cloudflare account access when testing deployment-specific functionality

Clone the repository:

```bash
git clone https://github.com/Greenhawk5/HawkBucks-Bot.git
cd HawkBucks-Bot
npm install
```

Run the local development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Use the project's deployment validation tooling when making changes that affect
production configuration:

```bash
node scripts/validate-deployment.js
```

## Branches

Use a focused branch for each change.

Examples:

```text
feature/add-reminder-option
fix/mission-parser
refactor/telegram-service
docs/update-readme
test/mission-validation
```

Avoid committing directly to `main` for normal development.

## Commit Messages

Use concise, descriptive commit messages.

Recommended format:

```text
type: short description
```

Examples:

```text
feat: add channel reminder support
fix: handle missing mission reward
refactor: simplify mission normalization
test: cover reminder cycle acquisition
docs: improve deployment guide
chore: update dependencies
```

## Pull Requests

A good Pull Request should:

- Explain what changed.
- Explain why the change was necessary.
- Identify important implementation details.
- Include relevant testing information.
- Mention configuration or migration changes.
- Avoid unrelated changes.

Before submitting, check:

- [ ] Tests pass.
- [ ] Deployment validation passes when applicable.
- [ ] No secrets are present in the diff.
- [ ] No generated/local files were added accidentally.
- [ ] Documentation was updated when behavior changed.
- [ ] Database changes are documented when applicable.

## Mission Data Changes

Changes to mission parsing, normalization, merging, organization, or validation
should be tested against representative mission data.

Be especially careful with external-source changes because source formats can
change independently of HawkBucks Bot.

## Database Changes

When changing the D1 schema:

1. Update `database/schema.sql`.
2. Update affected database access modules.
3. Review migration/deployment implications.
4. Test locally where practical.
5. Document the change in the Pull Request.

Do not place runtime `CREATE TABLE` logic into application request handlers.

## Telegram Changes

Changes affecting commands, callbacks, groups, channels, or reminders should
consider both private-chat and group/channel behavior where applicable.

Avoid logging tokens, credentials, or sensitive Telegram data.

## Rendering Changes

When changing mission image generation:

- Verify the generated output.
- Check both cached and newly generated image paths.
- Avoid introducing hard-coded secrets.
- Consider the impact of external screenshot-generation requests.

## Review Standard

Contributions are evaluated primarily on:

- Correctness
- Reliability
- Maintainability
- Security
- Test coverage
- Scope discipline
- Clear documentation

Thank you for helping make HawkBucks Bot better.
