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

## inboxes threads list

List threads in an inbox (default subcommand of `resend inboxes threads`).
Pages are fixed at 50 threads, newest activity first — there is no `--limit`.

**Argument:** `<inboxId>` — inbox UUID (required in non-interactive mode)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--folder <folder>` | string | `inbox` | One of `inbox`, `archive`, `spam`, `sent`, `trash` |
| `--query <text>` | string | — | Search subject, sender, and label names |
| `--from <sender>` | string | — | Filter by sender address or name |
| `--label <labelId>` | string | — | Filter by label **UUID** (not name); repeat for multiple |
| `--cursor <cursor>` | string | — | `next_cursor` from a previous response |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"next_cursor":"<cursor>"|null,"data":[{"id":"<uuid>","subject":"<subject>"|null,"from":"<sender>"|null,"to":[],"cc":[],"bcc":[],"labels":[],"message_count":1,"has_attachment":false,"has_draft":false,"read":false,"received_at":"<date>"}]}`

---

## inboxes threads get

Retrieve a thread with every message inline, including `html` and `text`
bodies. Use the message `id` values as the email ID for replies.

**Arguments:** `<inboxId> <threadId>` (required in non-interactive mode)

**Output:** `{"object":"inbox_thread","id":"<uuid>","subject":"<subject>"|null,"folder":"inbox","labels":[],"read":true,"messages":{"has_more":false,"data":[{"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"subject":"<subject>"|null,"html":"<html>"|null,"text":"<text>"|null,"attachments":[],"read":true,"received_at":"<date>"}]}}`

---

## inboxes threads emails reply

Reply to a specific email in a thread. The reply is sent from the inbox
address to the sender of the original email.

**Arguments:** `<inboxId> <threadId> <emailId>` — all required; the email ID
comes from `inboxes threads get`

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--text <text>` | string | One of text/html | Plain text reply body |
| `--html <html>` | string | One of text/html | HTML reply body |
| `--subject <subject>` | string | No | Override the reply subject |

**Output:** `{"id":"<uuid>","email_id":"<uuid>","direction":"outbound","from":"<inbox-address>","to":["<recipient>"],"text":"<text>"|null,"html":"<html>"|null,"read":true,"received_at":"<date>"}`

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
