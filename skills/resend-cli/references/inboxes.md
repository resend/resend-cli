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

## inboxes threads update

Mark a thread read/unread, move it, or apply a label. At least one option is
required.

**Arguments:** `<inboxId> <threadId>` (required in non-interactive mode)

| Flag | Type | Description |
|------|------|-------------|
| `--read` | boolean | Mark every message in the thread as read |
| `--unread` | boolean | Mark every message in the thread as unread |
| `--folder <folder>` | string | Move to one of `inbox`, `archive`, `spam`, `trash` (`sent` is not a valid target) |
| `--label-id <labelId>` | string | Apply this label (UUID) to the thread |

**Output:** `{"object":"inbox_thread","id":"<uuid>","subject":"<subject>"|null,"folder":"<folder>","labels":[],"read":true}`

---

## inboxes threads delete

Delete a thread and all of its messages.

**Arguments:** `<inboxId> <threadId>`

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox_thread","id":"<uuid>","deleted":true}`

---

## inboxes threads emails get

Retrieve a single email from a thread.

**Arguments:** `<inboxId> <threadId> <emailId>` — all required

**Output:** `{"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>"|null,"html":"<html>"|null,"text":"<text>"|null,"attachments":[{"id":"<id>","filename":"<name>"|null,"size":123}],"read":true,"received_at":"<date>"}`

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

## inboxes threads emails forward

Forward an email to other recipients from the inbox address.

**Arguments:** `<inboxId> <threadId> <emailId>` — all required

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--to <address>` | string | Yes | Recipient; repeat the flag for multiple |
| `--text <text>` | string | No | Plain text note to include |
| `--html <html>` | string | No | HTML note to include |
| `--subject <subject>` | string | No | Override the forwarded subject |

**Output:** `{"id":"<uuid>","email_id":"<uuid>","direction":"outbound","from":"<inbox-address>","to":["<recipient>"],"text":"<text>"|null,"html":"<html>"|null,"attachments":[],"read":true,"received_at":"<date>"}`

---

## inboxes labels list

List all labels in an inbox (not paginated; default subcommand of
`resend inboxes labels`). Use label IDs with `threads update --label-id` and
`threads list --label`.

**Argument:** `<inboxId>`

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"id":"<uuid>","name":"<name>","color":"<color>","created_at":"<date>"}]}`

---

## inboxes labels create

Create a label. An inbox can have up to 100 labels.

**Argument:** `<inboxId>`

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | Label name, max 64 characters |
| `--color <color>` | string | No | One of `cyan`, `teal`, `grass`, `lime`, `yellow`, `orange`, `iris`, `plum`, `crimson`, `bronze`, `mauve` (random when omitted) |

**Output:** `{"object":"inbox_label","id":"<uuid>","name":"<name>","color":"<color>","created_at":"<date>"}`

---

## inboxes labels update

Update a label's name or color. At least one option is required.

**Arguments:** `<inboxId> <labelId>`

| Flag | Type | Description |
|------|------|-------------|
| `--name <name>` | string | New label name |
| `--color <color>` | string | New label color (same choices as create) |

**Output:** `{"object":"inbox_label","id":"<uuid>"}`

---

## inboxes labels delete

Delete a label. It is removed from every thread that has it.

**Arguments:** `<inboxId> <labelId>`

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox_label","id":"<uuid>","deleted":true}`

---

## inboxes drafts list

List drafts in an inbox (default subcommand of `resend inboxes drafts`).
Opaque cursor pagination like threads — no `--limit`.

**Argument:** `<inboxId>`

| Flag | Type | Description |
|------|------|-------------|
| `--cursor <cursor>` | string | `next_cursor` from a previous response |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"next_cursor":"<cursor>"|null,"data":[{"id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>"|null,"snippet":"<text>"|null,"thread_id":"<uuid>"|null,"reply_to_email_id":"<uuid>"|null,"updated_at":"<date>"}]}`

---

## inboxes drafts create

Create a standalone draft, or a reply draft when `--thread-id` and
`--reply-to-email-id` are passed **together**. At least one content field is
required.

**Argument:** `<inboxId>`

| Flag | Type | Description |
|------|------|-------------|
| `--to <address>` | string | Recipient; repeat for multiple |
| `--cc <address>` | string | Cc; repeat for multiple |
| `--bcc <address>` | string | Bcc; repeat for multiple |
| `--subject <subject>` | string | Draft subject |
| `--text <text>` | string | Plain text body |
| `--html <html>` | string | HTML body |
| `--thread-id <threadId>` | string | Thread to reply to (pairs with `--reply-to-email-id`) |
| `--reply-to-email-id <emailId>` | string | Email the draft replies to (pairs with `--thread-id`) |

**Output:** `{"object":"inbox_draft","id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>"|null,"html":"<html>"|null,"text":"<text>"|null,"thread_id":"<uuid>"|null,"reply_to_email_id":"<uuid>"|null,"email_id":null,"created_at":"<date>","updated_at":"<date>"}`

---

## inboxes drafts get

Retrieve a draft, including its full body.

**Arguments:** `<inboxId> <draftId>`

**Output:** same shape as `drafts create`.

---

## inboxes drafts update

Update a draft's recipients, subject, or body. At least one option is
required; provided fields replace existing values. Same flags as
`drafts create` minus `--thread-id`/`--reply-to-email-id`.

**Arguments:** `<inboxId> <draftId>`

**Output:** same shape as `drafts create`.

---

## inboxes drafts delete

Delete a draft.

**Arguments:** `<inboxId> <draftId>`

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox_draft","id":"<uuid>","deleted":true}`

---

## inboxes drafts send

Send a draft from the inbox address. The draft must have recipients and a
body.

**Arguments:** `<inboxId> <draftId>`

**Output:** `{"object":"inbox_draft","id":"<uuid>","thread_id":"<uuid>","email_id":"<uuid>"}`

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
