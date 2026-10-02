# inboxes

Detailed flag specifications for `resend inboxes` commands.

> **Beta:** Inboxes is a pre-GA feature gated per account. Commands appear in
> `--help` but return an API error unless inboxes is enabled for your account.
> Reach out to Resend to join the beta.

An inbox is an email address at one of your verified domains that sends and
receives email. Receiving must be enabled on the domain, unless the inbox is
created with `--forwarding`. Received messages are grouped into threads inside
the inbox. Inboxes require a **full-access** API key — sending-only keys
are rejected.

---

## inboxes create

Create a new inbox at one of your verified domains.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--email_address <address>` | string | Yes (non-interactive) | Address for the inbox, e.g. `support@yourdomain.com` |
| `--name <name>` | string | No | Inbox name shown in the dashboard (max 64 chars) |
| `--from_name <name>` | string | No | Name used when sending from this inbox, e.g. `Ada from Support`. A plain name, not `Name <email>` |
| `--forwarding` | boolean | No | Receive mail without an MX record — Resend returns a `receiving_address` to forward mail to |

**Output:** `{"object":"inbox","id":"<uuid>","name":"<name>","email_address":"<address>","domain_id":"<uuid>","receiving_address":"<address>"|null,"from_name":"<name>"|null,"unread":0,"drafts":0,"last_received":"<date>"|null,"created_at":"<date>"}`

---

## inboxes list

List all inboxes (default subcommand — `resend inboxes` alone runs it).

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results, 1-100 |
| `--after <cursor>` | string | — | Forward pagination cursor (an inbox ID) |
| `--before <cursor>` | string | — | Backward pagination cursor (an inbox ID) |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"id":"<uuid>","name":"<name>"|null,"email_address":"<address>","from_name":"<name>"|null,"unread":0,"last_received":"<date>"|null}]}`

---

## inboxes get

Retrieve a single inbox by ID or email address.

**Argument:** `<id>` — inbox UUID or inbox email address, e.g. `support@yourdomain.com` (required in non-interactive mode)

**Output:** `{"object":"inbox","id":"<uuid>","name":"<name>","email_address":"<address>","domain_id":"<uuid>","receiving_address":"<address>"|null,"from_name":"<name>"|null,"unread":0,"drafts":0,"last_received":"<date>"|null,"created_at":"<date>"}`

---

## inboxes update

Update an inbox's name or from name. At least one option is required.
The email address cannot be changed after creation.

**Argument:** `<id>` — inbox UUID

| Flag | Type | Description |
|------|------|-------------|
| `--name <name>` | string | New inbox name (max 64 chars) |
| `--from_name <name>` | string | New name used when sending from this inbox. A plain name, not `Name <email>`. Pass `""` to clear it |

**Output:** `{"object":"inbox","id":"<uuid>"}`

---

## inboxes threads list

List threads in an inbox (default subcommand of `resend inboxes threads`).
Threads are ordered by newest activity first.

**Flags:** `--inbox_id <id>` — required in non-interactive mode

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--folder <folder>` | string | `inbox` | One of `inbox`, `archive`, `spam`, `sent`, `trash` |
| `--query <text>` | string | — | Case-insensitive match against thread subjects and label names |
| `--label <label_id>` | string | — | Filter by label **UUID** (not name); repeat for multiple |
| `--limit <n>` | number | 10 | Max results, 1-100 |
| `--after <cursor>` | string | — | Forward pagination cursor (a thread ID) |
| `--before <cursor>` | string | — | Backward pagination cursor (a thread ID) |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"id":"<uuid>","subject":"<subject>"|null,"from":"<sender>"|null,"to":[],"cc":[],"bcc":[],"labels":[],"message_count":1,"has_attachment":false,"has_draft":false,"read":false,"received_at":"<date>"}]}`

---

## inboxes threads get

Retrieve a thread's summary. To read its messages, use
`inboxes threads emails list`.

**Flags:** `--inbox_id <id> --thread_id <id>` — required in non-interactive mode

**Output:** `{"object":"inbox_thread","id":"<uuid>","subject":"<subject>"|null,"folder":"inbox|archive|spam|sent|trash","labels":[],"read":true}`

---

## inboxes threads update

Mark a thread read/unread, move it, or apply a label. At least one option is
required.

**Flags:** `--inbox_id <id> --thread_id <id>` — required in non-interactive mode

| Flag | Type | Description |
|------|------|-------------|
| `--read` | boolean | Mark every message in the thread as read |
| `--unread` | boolean | Mark every message in the thread as unread |
| `--folder <folder>` | string | Move to one of `inbox`, `archive`, `spam`, `trash` (`sent` is not a valid target) |
| `--label_id <label_id>` | string | Apply this label (UUID) to the thread |

**Output:** `{"object":"inbox_thread","id":"<uuid>","subject":"<subject>"|null,"folder":"<folder>","labels":[],"read":true}`

---

## inboxes threads delete

Delete a thread and all of its messages.

**Flags:** `--inbox_id <id> --thread_id <id>` — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox_thread","id":"<uuid>","deleted":true}`

---

## inboxes threads emails list

List the emails in a thread, oldest first, with their `html` and `text` bodies
(default subcommand of `resend inboxes threads emails`). Use the email `id`
values with `emails get`, `reply`, and `forward`.

**Flags:** `--inbox_id <id> --thread_id <id>` — required in non-interactive mode

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results, 1-100 |
| `--after <cursor>` | string | — | Forward pagination cursor (an email ID) |
| `--before <cursor>` | string | — | Backward pagination cursor (an email ID) |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>"|null,"message_id":"<message-id>"|null,"html":"<html>"|null,"text":"<text>"|null,"attachments":[],"read":true,"received_at":"<date>"}]}`

---

## inboxes threads emails get

Retrieve a single email from a thread.

**Flags:** `--inbox_id <id> --thread_id <id> --email_id <id>` — required in non-interactive mode

**Output:** `{"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>"|null,"message_id":"<message-id>"|null,"html":"<html>"|null,"text":"<text>"|null,"attachments":[{"id":"<id>","filename":"<name>"|null,"size":123|null}],"read":true,"received_at":"<date>"}`

---

## inboxes threads emails reply

Reply to a specific email in a thread. The reply is sent from the inbox
address. The recipient comes from the original email. The total number of
recipients cannot exceed 50.

**Flags:** `--inbox_id <id> --thread_id <id> --email_id <id>` — required in
non-interactive mode; the email ID comes from `inboxes threads emails list`

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--cc <address>` | string | No | Cc address; repeat for multiple. Not copied from the original email |
| `--bcc <address>` | string | No | Bcc address; repeat for multiple. Not copied from the original email |
| `--text <text>` | string | One of text/html | Plain text reply body |
| `--html <html>` | string | One of text/html | HTML reply body |
| `--subject <subject>` | string | No | Override the reply subject |

**Output:** `{"id":"<uuid>","email_id":"<uuid>","direction":"outbound","from":"<inbox-address>","to":["<recipient>"],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>"|null,"message_id":"<message-id>"|null,"html":"<html>"|null,"text":"<text>"|null,"attachments":[],"read":true,"received_at":"<date>"}`

---

## inboxes threads emails forward

Forward an email to other recipients from the inbox address.

**Flags:** `--inbox_id <id> --thread_id <id> --email_id <id>` — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--to <address>` | string | Yes | Recipient; repeat the flag for multiple |
| `--cc <address>` | string | No | Cc address; repeat for multiple |
| `--bcc <address>` | string | No | Bcc address; repeat for multiple |
| `--text <text>` | string | No | Plain text note to include |
| `--html <html>` | string | No | HTML note to include |
| `--subject <subject>` | string | No | Override the forwarded subject |

`--to`, `--cc`, and `--bcc` combined cannot exceed 50 recipients.

**Output:** `{"id":"<uuid>","email_id":"<uuid>","direction":"outbound","from":"<inbox-address>","to":["<recipient>"],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>"|null,"message_id":"<message-id>"|null,"html":"<html>"|null,"text":"<text>"|null,"attachments":[],"read":true,"received_at":"<date>"}`

---

## inboxes labels list

List all labels in an inbox (not paginated; default subcommand of
`resend inboxes labels`). Use label IDs with `threads update --label_id` and
`threads list --label`.

**Flags:** `--inbox_id <id>` — required in non-interactive mode

**Alias:** `ls`

**Output:** `{"object":"list","data":[{"id":"<uuid>","name":"<name>","color":"<color>","created_at":"<date>"}]}`

---

## inboxes labels create

Create a label. An inbox can have up to 100 labels.

**Flags:** `--inbox_id <id>` — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | Label name, max 64 characters |
| `--color <color>` | string | No | One of `cyan`, `teal`, `grass`, `lime`, `yellow`, `orange`, `iris`, `plum`, `crimson`, `bronze`, `mauve` (random when omitted) |

**Output:** `{"object":"inbox_label","id":"<uuid>","name":"<name>","color":"<color>","created_at":"<date>"}`

---

## inboxes labels update

Update a label's name or color. At least one option is required.

**Flags:** `--inbox_id <id> --label_id <id>` — required in non-interactive mode

| Flag | Type | Description |
|------|------|-------------|
| `--name <name>` | string | New label name |
| `--color <color>` | string | New label color (same choices as create) |

**Output:** `{"object":"inbox_label","id":"<uuid>"}`

---

## inboxes labels delete

Delete a label. It is removed from every thread that has it.

**Flags:** `--inbox_id <id> --label_id <id>` — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox_label","id":"<uuid>","deleted":true}`

---

## inboxes drafts list

List drafts in an inbox (default subcommand of `resend inboxes drafts`).

**Flags:** `--inbox_id <id>` — required in non-interactive mode

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results, 1-100 |
| `--after <cursor>` | string | — | Forward pagination cursor (a draft ID) |
| `--before <cursor>` | string | — | Backward pagination cursor (a draft ID) |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>"|null,"snippet":"<text>"|null,"thread_id":"<uuid>"|null,"reply_to_email_id":"<uuid>"|null,"updated_at":"<date>"}]}`

---

## inboxes drafts create

Create a standalone draft, or a reply draft when `--thread_id` and
`--reply_to_email_id` are passed **together**. A reply draft does not copy
recipients from the email it replies to, so set `--to` before you send it. At
least one content field is required. Combined recipients cannot exceed 50.

**Flags:** `--inbox_id <id>` — required in non-interactive mode

| Flag | Type | Description |
|------|------|-------------|
| `--to <address>` | string | Recipient; repeat for multiple |
| `--cc <address>` | string | Cc; repeat for multiple |
| `--bcc <address>` | string | Bcc; repeat for multiple |
| `--subject <subject>` | string | Draft subject |
| `--text <text>` | string | Plain text body |
| `--html <html>` | string | HTML body |
| `--thread_id <thread_id>` | string | Thread to reply to (pairs with `--reply_to_email_id`) |
| `--reply_to_email_id <email_id>` | string | Email the draft replies to (pairs with `--thread_id`) |

**Output:** `{"object":"inbox_draft","id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>"|null,"html":"<html>"|null,"text":"<text>"|null,"thread_id":"<uuid>"|null,"reply_to_email_id":"<uuid>"|null,"email_id":null,"created_at":"<date>","updated_at":"<date>"}`

---

## inboxes drafts get

Retrieve a draft, including its full body.

**Flags:** `--inbox_id <id> --draft_id <id>` — required in non-interactive mode

**Output:** same shape as `drafts create`.

---

## inboxes drafts update

Update a draft's recipients, subject, or body. At least one option is
required; provided fields replace existing values. Same flags as
`drafts create` minus `--thread_id`/`--reply_to_email_id`.

**Flags:** `--inbox_id <id> --draft_id <id>` — required in non-interactive mode

**Output:** same shape as `drafts create`.

---

## inboxes drafts delete

Delete a draft.

**Flags:** `--inbox_id <id> --draft_id <id>` — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox_draft","id":"<uuid>","deleted":true}`

---

## inboxes drafts send

Send a draft from the inbox address. The draft must have recipients and a
body.

**Flags:** `--inbox_id <id> --draft_id <id>` — required in non-interactive mode

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
