# Resend CLI

The official CLI for [Resend](https://resend.com).

Built for humans, AI agents, and CI/CD pipelines.

```
██████╗ ███████╗███████╗███████╗███╗   ██╗██████╗
██╔══██╗██╔════╝██╔════╝██╔════╝████╗  ██║██╔══██╗
██████╔╝█████╗  ███████╗█████╗  ██╔██╗ ██║██║  ██║
██╔══██╗██╔══╝  ╚════██║██╔══╝  ██║╚██╗██║██║  ██║
██║  ██║███████╗███████║███████╗██║ ╚████║██████╔╝
╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝╚═════╝
```

## Install

### cURL

```sh
curl -fsSL https://resend.com/install.sh | bash
```

### Node.js

```sh
npm install -g resend-cli
```

### Homebrew (macOS / Linux)

```sh
brew install resend/cli/resend
```

### PowerShell (Windows)

```sh
irm https://resend.com/install.ps1 | iex
```

Or download the `.exe` directly from the [GitHub releases page](https://github.com/resend/resend-cli/releases/latest).

## Quickstart

```bash
# Authenticate
resend login

# Send an email
resend emails send \
  --from "you@example.com" \
  --to delivered@resend.dev \
  --subject "Hello from Resend CLI" \
  --text "Sent from my terminal."

# Check your environment
resend doctor
```

## Agent skills

This CLI ships with an [agent skill](skills/resend-cli/SKILL.md) that teaches AI coding agents (Cursor, Claude Code, Windsurf, etc.) how to use the Resend CLI effectively, including non-interactive flags, output formats, and common pitfalls.

To install skills for Resend's full platform (API, CLI, React Email, email best practices) from the [central skills repository](https://github.com/resend/resend-skills):

```sh
npx skills add resend/resend-skills
```

## Local development

Use this when you want to change the CLI and run your build locally.

### Prerequisites

- [Node.js](https://nodejs.org) 20+

### Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/resend/resend-cli.git
   cd resend-cli
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Build locally**

   ```bash
   pnpm build
   ```

   Output: `./dist/cli.cjs`

## Running the CLI locally

Use the dev script:

```bash
pnpm dev --version
```

Or run the built JS bundle:

```bash
node dist/cli.cjs --version
```

### Making changes

After editing source files, rebuild:

```bash
pnpm build
```

### Building native binaries

To build a standalone native binary:

```bash
pnpm build:bin
```

Output: `./dist/resend`

---

## Authentication

The CLI resolves your API key using the following priority chain:

| Priority    | Source                   | How to set                                |
| ----------- | ------------------------ | ----------------------------------------- |
| 1 (highest) | `--api-key` flag         | `resend --api-key re_xxx emails send ...` |
| 2           | `RESEND_API_KEY` env var | `export RESEND_API_KEY=re_xxx`            |
| 3 (lowest)  | Config file              | `resend login`                            |

If no key is found from any source, the CLI errors with code `auth_error`.

---

## Commands

### `resend login`

Authenticate by storing your API key locally. The key is validated against the Resend API before being saved.

```bash
resend login
```

#### Interactive mode (default in terminals)

When run in a terminal, the command checks for an existing key:

- **No key found**: Offers to open the [Resend API keys dashboard](https://resend.com/api-keys) in your browser so you can create one, then prompts for the key.
- **Existing key found**: Shows the key source (`env`, `config`) and prompts for a new key to replace it.

Enter the key via a masked password input. Your key must start with `re_`.

#### Non-interactive mode (CI, pipes, scripts)

When stdin is not a TTY, the `--key` flag is required:

```bash
resend login --key re_xxxxxxxxxxxxx
```

Omitting `--key` in non-interactive mode exits with error code `missing_key`.

#### Options

| Flag          | Description                                         |
| ------------- | --------------------------------------------------- |
| `--key <key>` | API key to store (required in non-interactive mode) |

#### Output

On success, credentials are saved to `~/.config/resend/credentials.json` with `0600` permissions (owner read/write only). The config directory is created with `0700` permissions.

```bash
# JSON output
resend login --key re_xxx --json
# => {"success":true,"config_path":"/Users/you/.config/resend/credentials.json"}
```

#### Error codes

| Code                 | Cause                                       |
| -------------------- | ------------------------------------------- |
| `missing_key`        | No `--key` provided in non-interactive mode |
| `invalid_key_format` | Key does not start with `re_`               |
| `validation_failed`  | Resend API rejected the key                 |

#### Switch between teams and accounts

If you work across multiple Resend teams or accounts, the CLI handles that, too.

Switch between profiles without logging in and out:

```bash
resend auth switch
```

You can also use the global `--profile` (or `-p`) flag on any command to run it with a specific profile.

```bash
resend domains list --profile production
```

---

### `resend emails send`

Send an email via the Resend API.

Provide all options via flags for scripting, or let the CLI prompt interactively for missing fields.

```bash
resend emails send \
  --from "Name <sender@example.com>" \
  --to delivered@resend.dev \
  --subject "Subject line" \
  --text "Plain text body"
```

#### Options

| Flag                   | Required                   | Description                                             |
| ---------------------- | -------------------------- | ------------------------------------------------------- |
| `--from <address>`     | Yes                        | Sender email address (must be from a verified domain)   |
| `--to <addresses...>`  | Yes                        | One or more recipient email addresses (space-separated) |
| `--subject <subject>`  | Yes                        | Email subject line                                      |
| `--text <text>`        | One of text/html/html-file | Plain text body                                         |
| `--html <html>`        | One of text/html/html-file | HTML body as a string                                   |
| `--html-file <path>`   | One of text/html/html-file | Path to an HTML file to use as body                     |
| `--cc <addresses...>`  | No                         | CC recipients (space-separated)                         |
| `--bcc <addresses...>` | No                         | BCC recipients (space-separated)                        |
| `--reply-to <address>` | No                         | Reply-to email address                                  |

#### Interactive mode

When run in a terminal without all required flags, the CLI prompts for missing fields:

```bash
# prompts for from, to, subject, and body
resend emails send

# prompts only for missing fields
resend emails send --from "you@example.com"
```

#### Non-interactive mode

When piped or run in CI, all required flags must be provided. Missing flags cause an error listing what's needed:

```bash
echo "" | resend emails send --from "you@example.com"
# Error: Missing required flags: --to, --subject
```

A body (`--text`, `--html`, or `--html-file`) is also required — omitting all three exits with code `missing_body`.

#### Examples

**Multiple recipients:**

```bash
resend emails send \
  --from "you@example.com" \
  --to delivered@resend.dev bounced@resend.dev \
  --subject "Team update" \
  --text "Hello everyone"
```

**HTML from a file:**

```bash
resend emails send \
  --from "you@example.com" \
  --to delivered@resend.dev \
  --subject "Newsletter" \
  --html-file ./newsletter.html
```

**With CC, BCC, and reply-to:**

```bash
resend emails send \
  --from "you@example.com" \
  --to delivered@resend.dev \
  --subject "Meeting notes" \
  --text "See attached." \
  --cc manager@example.com \
  --bcc delivered+1@resend.dev \
  --reply-to support@example.com
```

**Overriding the API key for one send:**

```bash
resend --api-key re_other_key emails send \
  --from "you@example.com" \
  --to delivered@resend.dev \
  --subject "Test" \
  --text "Using a different key"
```

#### Output

Returns the email ID on success:

```json
{ "id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }
```

#### Error codes

| Code              | Cause                                            |
| ----------------- | ------------------------------------------------ |
| `auth_error`      | No API key found or client creation failed       |
| `missing_body`    | No `--text`, `--html`, or `--html-file` provided |
| `file_read_error` | Could not read the file passed to `--html-file`  |
| `send_error`      | Resend API returned an error                     |

---

### `resend doctor`

Run environment diagnostics. Verifies your CLI version, API key, domains, and detects AI agent integrations.

```bash
resend doctor
```

#### Checks performed

| Check           | Pass                                    | Warn                                     | Fail            |
| --------------- | --------------------------------------- | ---------------------------------------- | --------------- |
| **CLI Version** | Running latest                          | Update available or registry unreachable | —               |
| **API Key**     | Key found (shows masked key and source) | —                                        | No key found    |
| **Domains**     | Verified domains exist                  | No domains or all pending verification   | API key invalid |
| **AI Agents**   | Lists detected agents (or none)         | —                                        | —               |

The API key is always masked in output (e.g. `re_...xxxx`).

#### Interactive mode

In a terminal, shows animated spinners for each check with colored status icons:

```
  Resend Doctor

  ✔ CLI Version: v0.1.0 (latest)
  ✔ API Key: re_...xxxx (source: env)
  ✔ Domains: 2 verified, 0 pending
  ✔ AI Agents: Detected: Cursor, Claude Desktop
```

#### JSON mode

```bash
resend doctor --json
```

```json
{
  "ok": true,
  "checks": [
    { "name": "CLI Version", "status": "pass", "message": "v0.1.0 (latest)" },
    {
      "name": "API Key",
      "status": "pass",
      "message": "re_...xxxx (source: env)"
    },
    { "name": "Domains", "status": "pass", "message": "2 verified, 0 pending" },
    { "name": "AI Agents", "status": "pass", "message": "Detected: Cursor" }
  ]
}
```

Each check has a `status` of `pass`, `warn`, or `fail`. The top-level `ok` is `false` if any check is `fail`.

#### Detected AI agents

| Agent          | Detection method                        |
| -------------- | --------------------------------------- |
| OpenClaw       | `~/clawd/skills` directory exists       |
| Cursor         | `~/.cursor` directory exists            |
| Claude Desktop | Platform-specific config file exists    |
| VS Code        | `.vscode/mcp.json` in current directory |

#### Exit code

Exits `0` when all checks pass or warn. Exits `1` if any check fails.

---

### Webhooks

With the Resend CLI, you can manage webhook endpoints so your app receives real-time event notifications.

Payloads are signed with [Svix](https://docs.svix.com/receiving/verifying-payloads/how) headers (`svix-id`, `svix-timestamp`, `svix-signature`). Verify them in your app with the Resend SDK.

For example: `resend.webhooks.verify({ payload, headers, webhookSecret })`

There are many events that you can listen for in your application.

For example, you can:

- Set up a POST endpoint to unsubscribe users when an email bounces or they mark your email as spam.
- Notify yourself when you get a new subscriber using the `contact.created` event.
- Use an `email.received` webhook to set up an inbox for your agent and notify it when a new email is received.

#### Event types

| Category | Events                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email    | `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, `email.scheduled`, `email.suppressed`, `email.received` |
| Contact  | `contact.created`, `contact.updated`, `contact.deleted`, `contact.topics.updated`                                                                                                                        |
| Domain   | `domain.created`, `domain.updated`, `domain.deleted`                                                                                                                                                     |
| Topic    | `topic.created`, `topic.updated`, `topic.deleted`                                                                                                                                                        |
| Inbox    | `inbox.created`, `inbox.updated`, `inbox.deleted`, `inbox.thread.created`, `inbox.email.received`, `inbox.email.sent`, `inbox.thread.folder.updated`, `inbox.thread.assigned`, `inbox.thread.unassigned`, `inbox.thread.labels.updated`, `inbox.draft.created`, `inbox.draft.updated`, `inbox.draft.sent`, `inbox.draft.deleted` |

Use `all` with `--events` to subscribe to every event.

#### Subcommands

- `list`
- `create`
- `get`
- `update`
- `delete`
- `rotate-signing-secret`
- `listen`
- `events` (`list`, `get`, `attempts`, `replay`)

#### Aliases

- `webhooks ls` → `list`
- `webhooks rm` → `delete`
- `webhooks events ls` → `webhooks events list`

---

#### **`resend webhooks list`**

Lists existing webhooks.

Running `resend webhooks` with no subcommand runs `list`.

| Flag                | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `--limit <n>`       | Max webhooks to return (`1`–`100`, default `10`)          |
| `--after <cursor>`  | Return webhooks after this cursor (webhook ID; next page) |
| `--before <cursor>` | Return webhooks before this cursor (previous page)        |

Only one of `--after` or `--before` may be used. The API response includes `has_more` when more pages exist.

```bash
resend webhooks list
resend webhooks list --limit 25
resend webhooks list --after wh_abc123 --json
```

#### **`resend webhooks create`**

Registers a new endpoint.

The endpoint must use **HTTPS**. Use the **`signing_secret`** in the response to verify incoming payloads. `resend webhooks get` returns it again.

In interactive mode, the CLI can prompt for endpoint and events. In non-interactive mode (pipes, CI, `--json`), **`--endpoint` and `--events` are required.**

| Flag                   | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `--endpoint <url>`     | HTTPS URL that receives webhook POSTs             |
| `--events <events...>` | Event names (comma- or space-separated), or `all` |

```bash
resend webhooks create --endpoint https://app.example.com/hooks/resend --events all
resend webhooks create --endpoint https://app.example.com/hooks/resend --events email.sent email.bounced
resend webhooks create --endpoint https://app.example.com/hooks/resend --events email.sent,email.delivered
```

#### **`resend webhooks get`**

Fetches one webhook by ID.

Omit the ID in a terminal to pick from a list.

```bash
resend webhooks get wh_abc123
resend webhooks get wh_abc123 --json
```

The response includes the signing secret. Use `resend webhooks rotate-signing-secret <id>` to replace it.

#### **`resend webhooks update`**

Updates the webhook:

- endpoint URL
- the full event list
- delivery status

**At least one** of `--endpoint`, `--events`, or `--status` is required.

| Flag                   | Description              |
| ---------------------- | ------------------------ |
| `--endpoint <url>`     | New HTTPS URL            |
| `--events <events...>` | New event list, or `all` |
| `--status <status>`    | `enabled` or `disabled`  |

Disabled status pauses delivery without deleting the webhook.

```bash
resend webhooks update wh_abc123 --status disabled
resend webhooks update wh_abc123 --endpoint https://new-app.example.com/hooks/resend
resend webhooks update wh_abc123 --events email.sent email.bounced
```

#### **`resend webhooks delete`**

Deletes a webhook and stops deliveries.

In non-interactive mode, **`--yes` is required** to confirm.

```bash
resend webhooks delete wh_abc123 --yes
```

To pause delivery temporarily, prefer `resend webhooks update <id> --status disabled`.

#### **`resend webhooks rotate-signing-secret`**

Generates a new signing secret for the webhook and returns it. For 24 hours, payloads are signed with both the new and the previous secret, so either one verifies them. After that, only the new secret does.

Omit the ID in a terminal to pick from a list.

```bash
resend webhooks rotate-signing-secret wh_abc123
resend webhooks rotate-signing-secret wh_abc123 --json
```

#### **`resend webhooks listen`**

Built-in local development helper. It:

- Starts a small HTTP server
- Registers a temporary Resend webhook pointing at your public tunnel URL
- Prints events in the terminal
- Deletes the webhook on exit

Your tunnel must forward to the same port as `--port`, e.g. `ngrok http 4318`.

| Flag                   | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `--url <url>`          | Public URL (tunnel) that reaches this machine — **required** |
| `--port <port>`        | Local server port (default `4318`)                           |
| `--events <events...>` | Events to subscribe to (default: all)                        |
| `--forward-to <url>`   | Also POST each payload to this URL (Svix headers preserved)  |

```bash
# Terminal 1: tunnel to the listen port
ngrok http 4318

# Terminal 2: use the HTTPS URL ngrok gives you
resend webhooks listen --url https://xxxx.ngrok-free.app
resend webhooks listen --url https://xxxx.ngrok-free.app --forward-to localhost:3000/api/webhooks/resend
resend webhooks listen --url https://xxxx.ngrok-free.app --port 8080 --events email.sent email.bounced
```

#### **`resend webhooks events`**

Inspects what Resend already delivered to a webhook. Use it to debug an endpoint that is missing events:

1. `resend webhooks events list <webhook-id>` — find the event
2. `resend webhooks events get <webhook-id> <event-id>` — see the payload we sent
3. `resend webhooks events attempts <webhook-id> <event-id>` — see what your endpoint returned
4. `resend webhooks events replay <webhook-id> <event-id>` — queue another delivery

Running `resend webhooks events <webhook-id>` with no subcommand runs `list`.

Both list subcommands paginate forward only — there is no `--before`.

| Flag               | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `--limit <n>`      | Max results to return (`1`–`100`, default `10`)          |
| `--after <cursor>` | Return results after this ID (next page)                 |

`events list` reports each event's `type`, `status` (`pending`, `attempting`, `success`, `failed`), and `created_at`. `events get` adds `next_attempt_at` and the payload that was sent. `events attempts` reports the `http_status_code` and response body your endpoint returned for each try. `events replay` queues one more delivery attempt and returns `{"object":"webhook_event","id":"<event-id>"}`; it does not schedule automatic retries.

```bash
resend webhooks events list wh_abc123
resend webhooks events list wh_abc123 --limit 50 --json
resend webhooks events get wh_abc123 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2
resend webhooks events attempts wh_abc123 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2
resend webhooks events replay wh_abc123 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2
```

---

### Inboxes

With the Resend CLI, you can manage inboxes. An inbox is an email address at one of your verified domains that sends and receives email. Received emails are grouped into threads inside the inbox.

Inbox commands need a full-access API key.

#### Subcommands

- `list`
- `create`
- `get`
- `update`
- `delete`
- `threads` (`list`, `search`, `get`, `update`, `delete`)
- `threads emails` (`list`, `get`, `reply`, `forward`)
- `labels` (`list`, `create`, `update`, `delete`)
- `drafts` (`list`, `create`, `get`, `update`, `delete`, `send`)
- `agent` (`get`, `update`)

#### Aliases

- `inboxes ls` → `list`
- `inboxes rm` → `delete`
- `ls` and `rm` also work on `threads`, `threads emails` (`ls` only), `labels`, and `drafts`

Running a group with no subcommand runs its `list`, or `get` for `agent`. In a terminal, omit an ID to pick from a list.

---

#### **`resend inboxes list`**

Lists the inboxes of the team, newest first. Takes `--limit`, `--after`, and `--before`, like `resend webhooks list`.

```bash
resend inboxes list
resend inboxes list --limit 25 --json
```

#### **`resend inboxes create`**

Creates an inbox at an address on one of your domains. Without `--forwarding`, the domain must have receiving enabled. With `--forwarding`, Resend generates a receiving address, so you can receive mail without an MX record.

The output holds only `{"object":"inbox","id":"<uuid>"}`. Run `resend inboxes get <id>` to read the other fields, such as `receiving_address`.

| Flag                        | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `--email_address <address>` | Inbox address — **required** in non-interactive mode                  |
| `--name <name>`             | Internal name, recipients do not see it                               |
| `--from_name <name>`        | Name recipients see when mail is sent from the inbox                  |
| `--forwarding`              | Receive mail without an MX record through a generated receiving address |

```bash
resend inboxes create --email_address support@yourdomain.com
resend inboxes create --email_address hello@yourdomain.com --name "Hello" --forwarding
```

#### **`resend inboxes get`**

Fetches one inbox by ID or by email address.

```bash
resend inboxes get 78261eea-8f8b-4381-83c6-79fa7120f1cf
resend inboxes get support@yourdomain.com --json
```

#### **`resend inboxes update`**

Updates the internal name or the from name. **At least one** of `--name` or `--from_name` is required. Pass `--from_name ""` to remove the from name.

```bash
resend inboxes update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Support"
resend inboxes update 78261eea-8f8b-4381-83c6-79fa7120f1cf --from_name "Ada from Support"
```

#### **`resend inboxes delete`**

Deletes an inbox. In non-interactive mode, **`--yes` is required** to confirm.

```bash
resend inboxes delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes
```

#### **`resend inboxes threads list`**

Lists the threads in an inbox, most recently active first.

| Flag                      | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `--inbox_id <id>`         | Inbox UUID                                                                  |
| `--folders <folders...>`  | `inbox`, `archive`, `spam`, `sent`, `trash` (default `inbox`, or `inbox archive sent` with `--labels`) |
| `--labels <label_ids...>` | Label UUIDs. Returns threads with any of them                               |
| `--read` / `--unread`     | Only threads where every email is read, or with at least one unread email   |
| `--limit`, `--after`, `--before` | Pagination, with thread IDs as cursors                               |

```bash
resend inboxes threads list --inbox_id <inbox_id>
resend inboxes threads list --inbox_id <inbox_id> --folders inbox archive --unread --json
```

#### **`resend inboxes threads search`**

Finds threads by the text of their emails, who sent or received them, attachments, and dates. Takes `--query`, `--from`, `--to`, `--cc`, `--bcc`, `--has_attachment`, `--without_attachment`, `--start_date`, and `--end_date`, plus the filters and pagination of `threads list`. Search can be up to about a minute behind new emails.

```bash
resend inboxes threads search --inbox_id <inbox_id> --query invoice
resend inboxes threads search --inbox_id <inbox_id> --from isabella@example.com --has_attachment --start_date 2026-09-01 --json
```

#### **`resend inboxes threads get`**

Fetches the summary of one thread. List its emails with `resend inboxes threads emails list`.

```bash
resend inboxes threads get --inbox_id <inbox_id> --thread_id <thread_id>
```

#### **`resend inboxes threads update`**

Marks a thread read or unread, moves it to a folder, or adds and removes labels. **At least one** option is required.

| Flag                                 | Description                                              |
| ------------------------------------ | -------------------------------------------------------- |
| `--read` / `--unread`                | Mark every email in the thread read or unread            |
| `--folder <folder>`                  | `inbox`, `archive`, `spam`, or `trash`                   |
| `--add_label_ids <label_ids...>`     | Label UUIDs to apply, 1 to 10                            |
| `--remove_label_ids <label_ids...>`  | Label UUIDs to remove, 1 to 10                           |

```bash
resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --read --folder archive
resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --add_label_ids <label_id>
```

#### **`resend inboxes threads delete`**

Moves a thread to `trash` and schedules it for deletion in 30 days. To restore it, move it to another folder with `threads update --folder`. In non-interactive mode, **`--yes` is required**.

```bash
resend inboxes threads delete --inbox_id <inbox_id> --thread_id <thread_id> --yes
```

#### **`resend inboxes threads emails list`**

Lists the emails of a thread, oldest first, with their bodies. Takes `--limit`, `--after`, and `--before`, with email IDs as cursors.

```bash
resend inboxes threads emails list --inbox_id <inbox_id> --thread_id <thread_id>
```

#### **`resend inboxes threads emails get`**

Fetches one email of a thread.

```bash
resend inboxes threads emails get --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id>
```

#### **`resend inboxes threads emails reply`**

Sends a reply from the inbox address. The reply goes to the `Reply-To` addresses of the email, or to its sender. If the inbox sent the email, the reply goes to its `to` recipients. `--reply-all` also copies the other recipients, without the inbox address and without duplicates. With `--reply-all`, a reply to an email the inbox sent goes to its `Reply-To` addresses when they are not the inbox address. **At least one** of `--text` or `--html` is required. The output holds the ID of the sent email.

| Flag                        | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `--text <text>`             | Plain-text body                                              |
| `--html <html>`             | HTML body                                                    |
| `--cc`, `--bcc <address>`   | Extra recipients (repeat the flag for more)                  |
| `--subject <subject>`       | Override the subject                                         |
| `--reply-all`               | Reply to everyone on the original email                      |
| `--attachment <specs...>`   | File path or URL to attach, as on `resend emails send`       |
| `--attachments-file <path>` | JSON array of attachment objects                             |
| `--headers <key=value...>`  | Custom headers. `In-Reply-To`, `References` and `Reply-To` are reserved. Names and values cannot contain line breaks |
| `--idempotency-key <key>`   | Deduplicate the send                                         |

```bash
resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "Thanks!"
resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "Invoice attached." --attachment ./invoice.pdf
```

#### **`resend inboxes threads emails forward`**

Forwards an email from the inbox address. **`--to` is required.** The attachments of the original email are sent with the forward. An original attachment that was sent from a URL cannot be forwarded. Takes `--cc`, `--bcc`, `--text`, `--html`, `--subject`, `--attachment`, `--attachments-file`, `--headers`, and `--idempotency-key`. The output holds the ID of the sent email.

```bash
resend inboxes threads emails forward --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --to teammate@example.com --text "FYI"
```

#### **`resend inboxes labels list`**

Lists every label of an inbox, oldest first. The list is not paginated.

```bash
resend inboxes labels list --inbox_id <inbox_id>
```

#### **`resend inboxes labels create`**

Creates a label. **`--name` is required.** `--color` takes a `#RRGGBB` hex color, random when omitted. Quote it so the shell keeps the `#`.

```bash
resend inboxes labels create --inbox_id <inbox_id> --name "Urgent" --color '#E93D82'
```

#### **`resend inboxes labels update`**

Renames or recolors a label. **At least one** of `--name` or `--color` is required.

```bash
resend inboxes labels update --inbox_id <inbox_id> --label_id <label_id> --name "Billing"
```

#### **`resend inboxes labels delete`**

Deletes a label and removes it from every thread. In non-interactive mode, **`--yes` is required**.

```bash
resend inboxes labels delete --inbox_id <inbox_id> --label_id <label_id> --yes
```

#### **`resend inboxes drafts list`**

Lists the unsent drafts of an inbox, most recently updated first. Takes `--limit`, `--after`, and `--before`.

```bash
resend inboxes drafts list --inbox_id <inbox_id>
```

#### **`resend inboxes drafts create`**

Creates a draft that starts a new thread. Pass `--thread_id` and `--reply_to_email_id` together for a reply draft. Takes `--to`, `--cc`, `--bcc`, `--subject`, `--text`, `--html`, `--attachment`, and `--attachments-file`. **At least one** of them is required. `--idempotency-key` deduplicates the request.

Draft attachments need `content`, `filename`, and `content_type`, so `--attachment` takes a local file with `;type=<MIME type>`. The files on a draft can total at most 25 MB.

```bash
resend inboxes drafts create --inbox_id <inbox_id> --to user@example.com --subject "Hello" --text "Draft body"
resend inboxes drafts create --inbox_id <inbox_id> --thread_id <thread_id> --reply_to_email_id <email_id> --text "Reply draft"
resend inboxes drafts create --inbox_id <inbox_id> --to user@example.com --text "Report attached" --attachment "./report.pdf;type=application/pdf"
```

#### **`resend inboxes drafts get`**

Fetches one draft with its full body.

```bash
resend inboxes drafts get --inbox_id <inbox_id> --draft_id <draft_id>
```

#### **`resend inboxes drafts update`**

Updates the recipients, subject, body, or attachments of an unsent draft. Setting `--text` or `--html` replaces the whole body. `--attachment` and `--attachments-file` replace every attachment on the draft, and `--clear-attachments` removes them all.

```bash
resend inboxes drafts update --inbox_id <inbox_id> --draft_id <draft_id> --subject "Updated subject"
resend inboxes drafts update --inbox_id <inbox_id> --draft_id <draft_id> --clear-attachments
```

#### **`resend inboxes drafts delete`**

Discards an unsent draft. In non-interactive mode, **`--yes` is required**.

```bash
resend inboxes drafts delete --inbox_id <inbox_id> --draft_id <draft_id> --yes
```

#### **`resend inboxes drafts send`**

Sends a draft from the inbox address. The draft needs at least one `to` recipient, a non-empty subject, and `html` or `text`. A reply draft created without `--subject` has an empty subject, so set one before you send it. `--headers` adds custom headers, except the reserved `In-Reply-To`, `References` and `Reply-To`. `--idempotency-key` deduplicates the send. The output holds the ID of the sent email.

```bash
resend inboxes drafts send --inbox_id <inbox_id> --draft_id <draft_id>
```

#### **`resend inboxes agent get`**

Fetches the agent settings of an inbox: `instructions`, `tone`, and `enabled_actions`.

```bash
resend inboxes agent get --inbox_id <inbox_id>
```

#### **`resend inboxes agent update`**

Updates the agent settings. **At least one** of `--instructions`, `--tone`, or `--enabled_actions` is required. Omitted fields keep their current value. `--enabled_actions` replaces the whole set.

```bash
resend inboxes agent update --inbox_id <inbox_id> --tone "friendly and concise"
resend inboxes agent update --inbox_id <inbox_id> --enabled_actions draft_reply add_labels
```

---

## Global options

These flags work on every command and are passed before the subcommand:

```bash
resend [global options] <command> [command options]
```

| Flag                   | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `--api-key <key>`      | Override API key for this invocation (takes highest priority) |
| `-p, --profile <name>` | Profile to use (overrides `RESEND_PROFILE` env var)           |
| `--json`               | Force JSON output even in interactive terminals               |
| `-q, --quiet`          | Suppress spinners and status output (implies `--json`)        |
| `--version`            | Print version and exit                                        |
| `--help`               | Show help text                                                |

---

## Output behavior

The CLI has two output modes:

| Mode            | When                   | Stdout              | Stderr                                   |
| --------------- | ---------------------- | ------------------- | ---------------------------------------- |
| **Interactive** | Terminal (TTY)         | Formatted text      | Spinners, prompts, human-readable errors |
| **Machine**     | Piped, CI, or `--json` | Success JSON only   | JSON errors; optional warnings (e.g. flags) |

Switching is automatic — pipe to another command and JSON output activates:

```bash
resend doctor | jq '.checks[].name'
resend emails send --from ... --to ... --subject ... --text ... | jq '.id'
```

### Error output

Errors always exit with code `1`. The format on **stderr** depends on output mode (same rules as the table above):

- **Machine** (piped stdout, CI, `--json`, or `-q`): structured JSON so **stdout** stays success-only for scripting (`jq`, etc.):

```json
{ "error": { "message": "No API key found", "code": "auth_error" } }
```

- **Interactive** (TTY without `--json` / `-q`): a human-readable line such as `Error: No API key found` (still on stderr).

---

## Agent & CI/CD usage

### CI/CD

Set `RESEND_API_KEY` as an environment variable — no `resend login` needed:

```yaml
# GitHub Actions
env:
  RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
steps:
  - run: |
      resend emails send \
        --from "deploy@example.com" \
        --to "delivered@resend.dev" \
        --subject "Deploy complete" \
        --text "Version ${{ github.sha }} deployed."
```

### AI agents

Agents calling the CLI as a subprocess automatically get JSON output (non-TTY detection). The contract:

- **Input:** All required flags must be provided (no interactive prompts)
- **Output:** Success JSON on stdout; error JSON on stderr (use `2>` or combined capture if you need both)
- **Exit code:** `0` success, `1` error
- **Errors:** Always include `message` and `code` fields
- **Discovery:** `resend commands` prints the full command tree as JSON (subcommands, options, descriptions).

### `resend commands`

Prints the CLI command tree as JSON for scripting and AI agents. In an interactive terminal, pass global `--json` if you need machine output; when stdout is piped, JSON is used automatically.

---

## Dry-run (no API call)

`--dry-run` validates a payload and prints it without calling the API. These commands support it:

- **`resend emails send ... --dry-run`** — validates inputs and prints `{ "dryRun": true, "request": { ... } }` without sending. Attachments appear as `filename` and `byteLength` only.
- **`resend broadcasts create ... --dry-run`** — same for the broadcast create payload.
- **`resend emails batch --file ./emails.json --dry-run`** — parses and normalises the JSON array, resolves any `--react-email` template, then prints the request payload without sending. No API key required.

Other commands do not support `--dry-run`.

---

## Configuration

| Item              | Path                                | Notes                                                        |
| ----------------- | ----------------------------------- | ------------------------------------------------------------ |
| Config directory  | `~/.config/resend/`                 | Respects `$XDG_CONFIG_HOME` on Linux, `%APPDATA%` on Windows |
| Credentials       | `~/.config/resend/credentials.json` | `0600` permissions (owner read/write)                        |
| Install directory | `~/.resend/bin/`                    | Respects `$RESEND_INSTALL`                                   |

## License

MIT
