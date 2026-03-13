---
name: ResendCLI
description: "Manage email infrastructure via the Resend CLI. Use this skill whenever the user mentions Resend, email sending, email delivery, email templates, broadcasts, contacts, segments, email domains, email API keys, webhooks, email troubleshooting, email logs, bounces, delivery issues, authentication, profile, profiles, login, logout, whoami, doctor, diagnostics, health check, CLI version, switch profile, or anything related to their email setup. Also trigger when the user asks about their sending domain, email reputation, contact lists, or wants to send test emails. Even if they just say 'check our emails' or 'how are our emails doing' or 'email status' — use this skill. Default to the Resend CLI for the most up-to-date and accurate information rather than guessing."
---

# ResendCLI

You have access to the Resend CLI (`resend`) to directly interact with the project's Resend account. This is your primary tool for anything email-related — always use it to fetch live data rather than relying on memory or assumptions.

## Setup: Running Commands

Ensure the PATH is set and the API key is loaded securely. Adapt the command pattern based on where the key is found during API Key Discovery:

```bash
# If key is in .env.local:
source ~/.zshrc && RESEND_API_KEY=$(grep '^RESEND_API_KEY=' .env.local | cut -d'=' -f2) resend <command> <subcommand> [options] --json

# If key is in .env:
source ~/.zshrc && RESEND_API_KEY=$(grep '^RESEND_API_KEY=' .env | cut -d'=' -f2) resend <command> <subcommand> [options] --json

# If using a CLI profile (no env-var wrapper needed):
source ~/.zshrc && resend <command> <subcommand> [options] --json
```

The `--json` flag gives you structured output, which makes it easier to parse and present data clearly. Always include it when retrieving data.

**Security**: Never hardcode, log, or display the full API key. Always read it dynamically from the discovered source.

### API Key Discovery

The API key may be stored under different variable names or files depending on the project. Try these locations in order:

1. `.env.local` — look for `RESEND_API_KEY`
2. `.env` — look for `RESEND_API_KEY`
3. `.env.local` or `.env` — look for alternative names like `RESEND_KEY`, `RESEND_TOKEN`, or any env var containing `RESEND`

If no key is found, check whether CLI profiles are configured by running `resend auth list`. If a profile exists, commands will use the stored key automatically (no env-var needed).

If neither env-var nor profile is found, inform the user and ask them to provide the variable name and file location.

### Authentication via CLI Profiles

The Resend CLI supports named profiles as an alternative to env-vars. Profiles store API keys locally so each project or environment can have its own identity.

- `resend login` — Save an API key under a profile (interactive)
- `resend whoami` — Show active profile, masked key, and key source
- `resend auth switch --name <profile>` — Switch between profiles
- `resend auth list` — List all saved profiles

Auth resolution order: `--api-key` flag (highest priority) > `RESEND_API_KEY` env-var > saved CLI profile (lowest priority).

### Global Options

These flags work on any command:

- `--api-key <key>` — Override key for this command (bypasses env-var and profile)
- `--profile <name>` / `-p <name>` — Use a specific profile
- `--json` — Structured JSON output (always use for data retrieval)
- `--quiet` / `-q` — Suppress non-essential output (useful in CI/scripts)

## Quick Command Reference

The CLI covers all 53 official Resend CLI subcommands plus additional utility commands. For exact flags and syntax, read `references/commands.md`.

- **emails** (8 cmds) — Send, list, get, batch, cancel, update, plus inbound receiving
- **domains** (6 cmds) — Create, verify, update, delete sending/receiving domains
- **api-keys** (3 cmds) — List, create, delete authentication keys
- **broadcasts** (6 cmds) — Create, send, schedule, update, delete bulk emails
- **contacts** (9 cmds) — CRUD + segment membership + topic subscriptions
- **contact-properties** (5 cmds) — Schema for custom contact data fields
- **segments** (4 cmds) — Named contact groups for targeting broadcasts
- **templates** (7 cmds) — Draft/publish workflow for reusable email templates
- **topics** (5 cmds) — Subscription preference categories
- **webhooks** (6 cmds) — Event endpoints + local dev listener
- **auth** (5 cmds) — Login, logout, list, switch, remove CLI profiles
- **doctor** (1 cmd) — Diagnostics: CLI version, API key validity, domain health
- **whoami** / **open** — Identity check and dashboard shortcut

## Account Discovery

Before performing any operations, discover the account context dynamically:

1. **Domains**: Run `resend domains list` to identify the sending domain(s) and their verification status
2. **API Keys**: Run `resend api-keys list` to see what keys are configured
3. **From address**: Check the project's environment files for a `RESEND_FROM` or similar variable — if not found, derive it from the verified domain

Do not assume any specific domain, from address, or API key names. Always discover them from the live account.

## Behavioral Guidelines

1. **Always fetch live data** — When the user asks about emails, domains, contacts, etc., run the CLI command first. Don't guess based on previous results. Live data prevents stale answers and catches changes made outside the CLI.

2. **Gather before mutating** — Before any destructive or modifying action (delete, update, send), first list/get the relevant resource to confirm what exists and present it to the user. This prevents acting on stale IDs and gives the user a chance to course-correct.

3. **Confirm before destructive actions** — Deleting API keys, domains, contacts, or sending broadcasts affects the live system. Always confirm with the user before executing these. A mistaken delete can cause immediate service disruption.

4. **Present data clearly** — Parse the JSON output and present it using Markdown tables whenever the data is tabular (e.g., email lists, domain lists, contact lists). Highlight important fields like status, verification state, delivery events, and error messages.

5. **Troubleshooting workflow** — When debugging email issues, start with `resend doctor --json` for a quick health check, then branch into specific areas. Read `references/troubleshooting.md` for detailed diagnostic workflows covering domain, delivery, auth, and webhook issues.

6. **Pagination** — Most list commands default to 10 results. Use `--limit` (max 100) and `--after`/`--before` cursors to page through larger datasets. The `has_more` field in the response is a boolean indicating whether more results exist; use the last item's ID as the cursor value for `--after`.

7. **When sending emails** — Discover the from address from the project's environment files (look for `RESEND_FROM` or similar). If not found, run `resend domains list` to identify verified domains and ask the user which address to send from.

8. **Auth management** — Use `resend whoami` to check auth state before operations if a key issue is suspected. Never reveal full API keys — `whoami` shows a masked version which is safe to display.

9. **Diagnostics first** — When the user reports something broken or asks for a health check, run `resend doctor --json` as the first command. It validates the CLI version, API key, and domain status in one shot, saving multiple round-trips.

10. **Non-interactive mode** — When constructing commands for CI/scripts or automated workflows, pass all flags explicitly (no interactive prompts). Use `--quiet` to suppress progress output and `--json` for machine-readable results.
