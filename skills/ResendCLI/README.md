# ResendCLI

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that gives Claude direct access to the [Resend CLI](https://resend.com/docs/cli) for managing email infrastructure.

## What it does

When this skill is active, Claude can use the Resend CLI to:

- Send and manage transactional emails
- Check domain verification status and DNS records
- Run diagnostics (`resend doctor`) and health checks
- Manage API keys, contacts, segments, and broadcasts
- Create and publish email templates
- Configure webhooks for real-time event notifications
- Manage CLI authentication profiles

The skill enforces safety guardrails — Claude will always confirm with you before sending emails, deleting resources, or performing other destructive actions.

## Installation

### From the standalone repo

```bash
git clone https://github.com/DomumDigital/ResendCLI.git ~/.claude/skills/ResendCLI
```

### From the resend-cli repo (if bundled)

If this skill is included in the `resend-cli` repo under `skills/`:

```bash
# Clone the resend-cli repo
git clone https://github.com/resend/resend-cli.git

# Copy the skill into your Claude Code skills directory
cp -r resend-cli/skills ~/.claude/skills/ResendCLI
```

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- [Resend CLI](https://resend.com/docs/cli) installed (`npm install -g resend`)
- A Resend API key — either:
  - Set `RESEND_API_KEY` in your project's `.env.local` or `.env` file, or
  - Log in via `resend login` to save a CLI profile

## How it triggers

The skill activates automatically when you mention anything related to Resend or email infrastructure — sending emails, checking domain status, managing contacts, troubleshooting delivery issues, reviewing webhooks, and more. Even casual prompts like "check our emails" or "how's our email setup" will trigger it.

## File structure

```
ResendCLI/
├── SKILL.md                        # Behavioral guide (loaded when skill triggers)
├── evals/
│   └── evals.json                  # 10 test cases with assertions
└── references/
    ├── commands.md                 # Full CLI command reference
    └── troubleshooting.md          # Diagnostic workflows
```

## Covered commands

All 53 official Resend CLI subcommands plus additional utility commands (auth profiles, doctor, whoami, open):

- **emails** — send, list, get, batch, cancel, update, receiving (inbound)
- **domains** — create, verify, update, delete, DNS management
- **api-keys** — list, create, delete
- **broadcasts** — create, send, schedule, update, delete
- **contacts** — CRUD, segment membership, topic subscriptions
- **contact-properties** — custom field schema management
- **segments** — named contact groups for targeting
- **templates** — draft/publish workflow, variables
- **topics** — subscription preference categories
- **webhooks** — event endpoints, local dev listener
- **auth** — login, logout, list, switch, remove profiles
- **doctor** — CLI version, API key, domain diagnostics
- **whoami / open** — identity check, dashboard shortcut

## License

MIT

## Attribution

Built by [Domum Digital](https://github.com/DomumDigital).
