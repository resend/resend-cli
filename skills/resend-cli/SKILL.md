---
name: resend-cli
description: >
  Operate the Resend platform from the terminal — send emails (including React Email
  .tsx templates via --react-email), manage domains, contacts, broadcasts, templates,
  webhooks, API keys, and logs via the `resend` CLI. Use when the user wants to run
  Resend commands in the shell, scripts, or CI/CD pipelines, or send/preview React
  Email templates. Always load this skill before running `resend` commands — it
  contains the non-interactive flag contract and gotchas that prevent silent failures.
license: MIT
metadata:
  author: resend
  version: "1.9.0"
  homepage: https://resend.com
  source: https://github.com/resend/resend-cli
inputs:
  - name: RESEND_API_KEY
    description: Resend API key for authenticating CLI commands. Get yours at https://resend.com/api-keys
    required: true
references:
  - references/emails.md
  - references/domains.md
  - references/api-keys.md
  - references/broadcasts.md
  - references/contacts.md
  - references/contact-properties.md
  - references/segments.md
  - references/templates.md
  - references/topics.md
  - references/logs.md
  - references/webhooks.md
  - references/auth.md
  - references/workflows.md
  - references/error-codes.md
---

# Resend CLI

## Installation

Before running any `resend` commands, check whether the CLI is installed:

```bash
resend --version
```

If the command is not found, install it using one of the methods below:

**cURL (macOS / Linux):**
```bash
curl -fsSL https://resend.com/install.sh | bash
```

**Homebrew (macOS / Linux):**
```bash
brew install resend/cli/resend
```

**Node.js:**
```bash
npm install -g resend-cli
```

**PowerShell (Windows):**
```powershell
irm https://resend.com/install.ps1 | iex
```

After installing, verify:
```bash
resend --version
```

## Agent Protocol

The CLI auto-detects non-TTY environments and outputs JSON — no `--json` flag needed.

**Rules for agents:**
- Supply ALL required flags. The CLI will NOT prompt when stdin is not a TTY.
- Pass `--quiet` (or `-q`) to suppress spinners and status messages.
- Exit `0` = success, `1` = error.
- Error JSON goes to stderr, success JSON goes to stdout:
  ```json
  {"error":{"message":"...","code":"..."}}
  ```
- Use `--api-key` or `RESEND_API_KEY` env var. Never rely on interactive login.
- All `delete`/`rm` commands require `--yes` in non-interactive mode.

## Authentication

Auth resolves: `--api-key` flag > `RESEND_API_KEY` env > config file (`resend login --key`). Use `--profile` or `RESEND_PROFILE` for multi-profile.

## Global Flags

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override API key for this invocation |
| `-p, --profile <name>` | Select stored profile |
| `--json` | Force JSON output (auto in non-TTY) |
| `-q, --quiet` | Suppress spinners/status (implies `--json`) |

## Available Commands

| Command Group | What it does |
|--------------|-------------|
| `emails` | send, get, list, batch, cancel, update |
| `emails receiving` | list, get, attachments, forward, listen |
| `domains` | create, verify, update, delete, list |
| `logs` | list, get, open |
| `api-keys` | create, list, delete |
| `broadcasts` | create, send, update, delete, list |
| `contacts` | create, update, delete, segments, topics |
| `contact-properties` | create, update, delete, list |
| `segments` | create, get, list, delete |
| `templates` | create, publish, duplicate, delete, list |
| `topics` | create, update, delete, list |
| `webhooks` | create, update, listen, delete, list |
| `auth` | login, logout, switch, rename, remove |
| `whoami` / `doctor` / `update` / `open` | Utility commands |

Read the matching reference file for detailed flags and output shapes.

## Common Mistakes

| # | Mistake | Fix |
|---|---------|-----|
| 1 | **Forgetting `--yes` on delete commands** | All `delete`/`rm` subcommands require `--yes` in non-interactive mode — otherwise the CLI exits with an error |
| 2 | **Not saving webhook `signing_secret`** | `webhooks create` shows the secret once only — it cannot be retrieved later. Capture it from command output immediately |
| 3 | **Omitting `--quiet` in CI** | Without `-q`, spinners and status text still go to stderr (not stdout). Use `-q` for JSON on stdout with no spinner noise on stderr |
| 4 | **Using `--scheduled-at` with batch** | Batch sending does not support `scheduled_at` — use single `emails send` instead |
| 5 | **Expecting `domains list` to include DNS records** | List returns summaries only — use `domains get <id>` for the full `records[]` array |
| 6 | **Sending a dashboard-created broadcast via CLI** | Only API-created broadcasts can be sent with `broadcasts send` — dashboard broadcasts must be sent from the dashboard |
| 7 | **Passing `--events` to `webhooks update` expecting additive behavior** | `--events` replaces the entire subscription list — always pass the complete set |
| 8 | **Expecting `logs list` to include request/response bodies** | List returns summary fields only — use `logs get <id>` for full `request_body` and `response_body` |

## Common Patterns

**Send an email:**
```bash
resend emails send --from "you@domain.com" --to user@example.com --subject "Hello" --text "Body"
```

**Send a React Email template (.tsx):**
```bash
resend emails send --from "you@domain.com" --to user@example.com --subject "Welcome" --react-email ./emails/welcome.tsx
```

**Domain setup flow:**
```bash
resend domains create --name example.com --region us-east-1
# Configure DNS records from output, then:
resend domains verify <domain-id>
resend domains get <domain-id>  # check status
```

**Create and send a broadcast:**
```bash
resend broadcasts create --from "news@domain.com" --subject "Update" --segment-id <id> --html "<h1>Hi</h1>" --send
```

**CI/CD (no login needed):**
```bash
RESEND_API_KEY=re_xxx resend emails send --from ... --to ... --subject ... --text ...
```

**Check environment health:**
```bash
resend doctor -q
```

## When to Load References

- **Sending or reading emails** → [references/emails.md](references/emails.md)
- **Setting up or verifying a domain** → [references/domains.md](references/domains.md)
- **Managing API keys** → [references/api-keys.md](references/api-keys.md)
- **Creating or sending broadcasts** → [references/broadcasts.md](references/broadcasts.md)
- **Managing contacts, segments, or topics** → [references/contacts.md](references/contacts.md), [references/segments.md](references/segments.md), [references/topics.md](references/topics.md)
- **Defining contact properties** → [references/contact-properties.md](references/contact-properties.md)
- **Working with templates** → [references/templates.md](references/templates.md)
- **Viewing API request logs** → [references/logs.md](references/logs.md)
- **Setting up webhooks or listening for events** → [references/webhooks.md](references/webhooks.md)
- **Auth, profiles, or health checks** → [references/auth.md](references/auth.md)
- **Multi-step recipes** (setup, CI/CD, broadcast workflow) → [references/workflows.md](references/workflows.md)
- **Command failed with an error** → [references/error-codes.md](references/error-codes.md)
- **Resend SDK integration** (Node.js, Python, Go, etc.) → Install the [`resend`](https://github.com/resend/resend-skills) skill
- **AI agent email inbox** → Install the [`agent-email-inbox`](https://github.com/resend/resend-skills) skill
