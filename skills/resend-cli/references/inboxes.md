# inboxes

Detailed flag specifications for `resend inboxes` commands.

> **Beta:** Inboxes is a pre-GA feature gated per account. Commands appear in
> `--help` but return an API error unless inboxes is enabled for your account.
> Reach out to Resend to join the beta.

An inbox is an email address at one of your verified domains (with receiving
enabled) that can receive email. Received messages are grouped into threads
inside the inbox. Inboxes require a **full-access** API key — sending-only keys
are rejected.

---

## inboxes create

Create a new inbox at one of your verified domains.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--email-address <address>` | string | Yes (non-interactive) | Address for the inbox, e.g. `support@yourdomain.com` |
| `--name <name>` | string | No | Inbox name shown in the dashboard (max 64 chars) |
| `--forwarding` | boolean | No | Enable forwarding — received emails are also forwarded to a generated forwarding address |

**Output:** `{"object":"inbox","id":"<uuid>","name":"<name>","email_address":"<address>","domain_id":"<uuid>","forwarding_address":"<address>"|null,"unread":0,"created_at":"<date>"}`

---

## inboxes list

List all inboxes (default subcommand — `resend inboxes` alone runs it).

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results, 1-100 |
| `--after <cursor>` | string | — | Forward pagination cursor (an inbox ID) |
| `--before <cursor>` | string | — | Backward pagination cursor (an inbox ID) |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"id":"<uuid>","name":"<name>"|null,"email_address":"<address>","unread":0,"last_received":"<date>"|null}]}`

---

## inboxes get

Retrieve a single inbox.

**Argument:** `<id>` — inbox UUID (required in non-interactive mode)

**Output:** `{"object":"inbox","id":"<uuid>","name":"<name>"|null,"email_address":"<address>","forwarding_address":"<address>"|null,"unread":0,"drafts":0,"last_received":"<date>"|null}`

---

## inboxes update

Update an inbox's name. The email address cannot be changed after creation.

**Argument:** `<id>` — inbox UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes | New inbox name (max 64 chars) |

**Output:** `{"object":"inbox","id":"<uuid>"}`

---

## inboxes delete

Delete an inbox. Its threads and messages are removed and the address stops
receiving email.

**Argument:** `<id>` — inbox UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox","id":"<uuid>","deleted":true}`
