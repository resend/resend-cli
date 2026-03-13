---
name: resend-cli
description: >
  Operate the Resend platform from the terminal — send emails, manage domains,
  contacts, broadcasts, templates, webhooks, and API keys via the `resend` CLI.
  Use when the user wants to run Resend commands in the shell, scripts, or CI/CD
  pipelines. Always load this skill before running `resend` commands — it contains
  the non-interactive flag contract and gotchas that prevent silent failures.
license: MIT
metadata:
  author: resend
  version: "1.4.1"
  homepage: https://resend.com
  source: https://github.com/resend/resend-cli
inputs:
  - name: RESEND_API_KEY
    description: Resend API key for authenticating CLI commands. Get yours at https://resend.com/api-keys
    required: true
references:
  - references/commands.md
  - references/workflows.md
  - references/error-codes.md
---

# Resend CLI

## Agent Protocol

The CLI auto-detects non-TTY environments and outputs JSON — no `--json` flag needed.

**Rules for agents:**
- Supply ALL required flags. The CLI will NOT prompt when stdin is not a TTY.
- Pass `--quiet` (or `-q`) to suppress spinners and status messages.
- Exit `0` = success, `1` = error.
- Success JSON goes to stdout, error JSON goes to stderr:
  ```json
  {"error":{"message":"...","code":"..."}}
  ```
- Use `--api-key` or `RESEND_API_KEY` env var. Never rely on interactive login.
- All `delete`/`rm` commands require `--yes` in non-interactive mode.

## Authentication

Priority (highest to lowest):

| Priority | Source | Example |
|----------|--------|---------|
| 1 | `--api-key` flag | `resend --api-key re_xxx emails send ...` |
| 2 | `RESEND_API_KEY` env | `export RESEND_API_KEY=re_xxx` |
| 3 | Config file | `resend login --key re_xxx` (stores in `~/.config/resend/credentials.json`) |

Multi-profile: use `--profile <name>` or `RESEND_PROFILE` env to select a stored profile.

## Global Flags

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override API key for this invocation |
| `-p, --profile <name>` | Select stored profile |
| `--json` | Force JSON output (auto in non-TTY) |
| `-q, --quiet` | Suppress spinners/status (implies `--json`) |
| `-v, --version` | Print version |
| `--help` | Show help |

## Command Map

### emails

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `send` | `--from`, `--to`, `--subject`, + one of `--text`/`--html`/`--html-file` | `{"id":"<uuid>"}` |
| `get <id>` | — | `{"object":"email","id":"...","from":"...","to":[...],"subject":"...","last_event":"...","created_at":"..."}` |
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `batch` | `--file <path>` | `[{"id":"..."},...]` or `{"data":[...],"errors":[...]}` |
| `cancel <id>` | — | `{"object":"email","id":"..."}` |
| `update <id>` | `--scheduled-at` | `{"object":"email","id":"..."}` |

**send** optional flags: `--cc`, `--bcc`, `--reply-to`, `--scheduled-at`, `--attachment <paths...>`, `--headers <key=value...>`, `--tags <name=value...>`, `--idempotency-key`

**list** optional flags: `--limit` (1-100, default 10), `--after`, `--before`

**batch** optional flags: `--idempotency-key`, `--batch-validation` (`strict`|`permissive`)

### emails receiving

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `get <id>` | — | Full email with html, text, headers, raw.download_url, attachments |
| `attachments <emailId>` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `attachment <emailId> <attachmentId>` | — | Single attachment with download_url |
| `forward <id>` | `--to`, `--from` | `{"id":"..."}` |

### domains

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `create` | `--name` | Domain object with `records[]` (DNS records to configure) |
| `get <id>` | — | Full domain with records, status, capabilities |
| `verify <id>` | — | `{"object":"domain","id":"..."}` |
| `update <id>` | At least one of `--tls`, `--open-tracking`/`--no-open-tracking`, `--click-tracking`/`--no-click-tracking` | `{"object":"domain","id":"..."}` |
| `delete <id>` | `--yes` (non-interactive) | `{"object":"domain","id":"...","deleted":true}` |

**create** optional flags: `--region` (`us-east-1`\|`eu-west-1`\|`sa-east-1`\|`ap-northeast-1`), `--tls` (`opportunistic`\|`enforced`), `--sending`, `--receiving`

### api-keys

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[{"id":"...","name":"...","created_at":"..."}]}` |
| `create` | `--name` | `{"id":"...","token":"re_..."}` (token shown once only) |
| `delete <id>` | `--yes` (non-interactive) | `{"object":"api-key","id":"...","deleted":true}` |

**create** optional flags: `--permission` (`full_access`\|`sending_access`), `--domain-id`

### broadcasts

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `create` | `--from`, `--subject`, `--segment-id`, + one of `--html`/`--html-file`/`--text` | `{"id":"..."}` |
| `get <id>` | — | Full broadcast object |
| `send <id>` | — | `{"id":"..."}` |
| `update <id>` | At least one of `--from`, `--subject`, `--html`, `--html-file`, `--text`, `--name` | `{"id":"..."}` |
| `delete <id>` | `--yes` (non-interactive) | `{"object":"broadcast","id":"...","deleted":true}` |

**create** optional flags: `--name`, `--reply-to`, `--preview-text`, `--topic-id`, `--send`, `--scheduled-at` (only with `--send`)

### contacts

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `create` | `--email` | `{"object":"contact","id":"..."}` |
| `get <id\|email>` | — | Full contact object |
| `update <id\|email>` | At least one option | `{"object":"contact","id":"..."}` |
| `delete <id\|email>` | `--yes` (non-interactive) | `{"object":"contact","id":"...","deleted":true}` |
| `segments <id\|email>` | — | `{"object":"list","data":[...]}` |
| `add-segment <contactId>` | `--segment-id` | `{"id":"..."}` |
| `remove-segment <contactId> <segmentId>` | — | `{"id":"...","deleted":true}` |
| `topics <id\|email>` | — | `{"object":"list","data":[...]}` |
| `update-topics <id\|email>` | `--topics <json>` | `{"id":"..."}` |

**create** optional flags: `--first-name`, `--last-name`, `--unsubscribed`, `--properties <json>`, `--segment-id <id...>`

**update** optional flags: `--unsubscribed`/`--no-unsubscribed`, `--properties <json>`

### contact-properties

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `create` | `--key`, `--type` (`string`\|`number`) | `{"object":"contact_property","id":"..."}` |
| `get <id>` | — | Full property definition |
| `update <id>` | `--fallback-value` or `--clear-fallback-value` | `{"object":"contact_property","id":"..."}` |
| `delete <id>` | `--yes` (non-interactive) | `{"object":"contact_property","id":"...","deleted":true}` |

### segments

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `create` | `--name` | `{"object":"segment","id":"...","name":"..."}` |
| `get <id>` | — | Full segment object |
| `delete <id>` | `--yes` (non-interactive) | `{"object":"segment","id":"...","deleted":true}` |

### templates

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `create` | `--name`, + `--html` or `--html-file` | `{"object":"template","id":"..."}` |
| `get <id\|alias>` | — | Full template with html, variables, status |
| `update <id\|alias>` | At least one option | `{"object":"template","id":"..."}` |
| `publish <id\|alias>` | — | `{"object":"template","id":"..."}` |
| `duplicate <id\|alias>` | — | `{"object":"template","id":"..."}` (new ID) |
| `delete <id\|alias>` | `--yes` (non-interactive) | `{"object":"template","id":"...","deleted":true}` |

**create/update** optional flags: `--subject`, `--text`, `--from`, `--reply-to`, `--alias`, `--var <KEY:type[:fallback]...>`

### topics

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"data":[...]}` |
| `create` | `--name` | `{"id":"..."}` |
| `get <id>` | — | Full topic object |
| `update <id>` | `--name` or `--description` | `{"id":"..."}` |
| `delete <id>` | `--yes` (non-interactive) | `{"object":"topic","id":"...","deleted":true}` |

**create** optional flags: `--description`, `--default-subscription` (`opt_in`\|`opt_out`)

### webhooks

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `list` | — | `{"object":"list","data":[...],"has_more":bool}` |
| `create` | `--endpoint`, `--events` | `{"object":"webhook","id":"...","signing_secret":"whsec_..."}` |
| `get <id>` | — | Full webhook config |
| `update <id>` | At least one of `--endpoint`, `--events`, `--status` | `{"object":"webhook","id":"..."}` |
| `delete <id>` | `--yes` (non-interactive) | `{"object":"webhook","id":"...","deleted":true}` |

**Available events:** `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, `email.scheduled`, `email.suppressed`, `email.received`, `contact.created`, `contact.updated`, `contact.deleted`, `domain.created`, `domain.updated`, `domain.deleted` — or use `all`

### auth

| Subcommand | Required Flags | Output Shape |
|------------|---------------|--------------|
| `login` | `--key` (non-interactive) | `{"success":true,"config_path":"...","profile":"..."}` |
| `logout` | — | `{"success":true,"config_path":"...","profile":"..."}` |
| `list` | — | `{"profiles":[{"name":"...","active":bool}]}` |
| `switch [name]` | — | `{"success":true,"active_profile":"..."}` |
| `rename [old] [new]` | — | `{"success":true,"old_name":"...","new_name":"..."}` |
| `remove [name]` | — | `{"success":true,"removed_profile":"..."}` |

### Utility Commands

| Command | Output Shape |
|---------|--------------|
| `whoami` | `{"authenticated":true,"profile":"...","api_key":"re_...abcd","source":"config\|env\|flag"}` |
| `doctor` | `{"ok":bool,"checks":[{"name":"...","status":"pass\|warn\|fail","message":"..."}]}` |
| `update` | `{"current":"...","latest":"...","update_available":bool,"upgrade_command":"..."}` |
| `open` | Opens Resend dashboard in browser |

## Common Mistakes

| # | Mistake | Fix |
|---|---------|-----|
| 1 | **Forgetting `--yes` on delete commands** | All `delete`/`rm` subcommands require `--yes` in non-interactive mode — otherwise the CLI exits with an error |
| 2 | **Not saving webhook `signing_secret`** | `webhooks create` shows the secret once only — it cannot be retrieved later. Capture it from command output immediately |
| 3 | **Omitting `--quiet` in CI** | Without `-q`, spinners and status text leak into stdout. Use `-q` to get clean JSON only |
| 4 | **Using `--scheduled-at` with batch** | Batch sending does not support `scheduled_at` — use single `emails send` instead |
| 5 | **Expecting `domains list` to include DNS records** | List returns summaries only — use `domains get <id>` for the full `records[]` array |
| 6 | **Sending a dashboard-created broadcast via CLI** | Only API-created broadcasts can be sent with `broadcasts send` — dashboard broadcasts must be sent from the dashboard |
| 7 | **Passing `--events` to `webhooks update` expecting additive behavior** | `--events` replaces the entire subscription list — always pass the complete set |

## Common Patterns

**Send an email:**
```bash
resend emails send --from "you@domain.com" --to user@example.com --subject "Hello" --text "Body"
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

## What Do You Need?

| Task | Reference |
|------|-----------|
| **Detailed flag specs for any command** | [references/commands.md](references/commands.md) |
| **Multi-step workflow recipes** (setup, domains, broadcasts, CI/CD, templates, webhooks) | [references/workflows.md](references/workflows.md) |
| **Error codes and troubleshooting** | [references/error-codes.md](references/error-codes.md) |
| **Resend SDK integration** (Node.js, Python, Go, etc.) | Install the `resend` skill — covers SDK usage, webhook verification, and template variables |
| **AI agent email inbox** | Install the `agent-email-inbox` skill — covers security levels for untrusted email input |
