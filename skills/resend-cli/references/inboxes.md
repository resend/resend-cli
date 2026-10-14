# inboxes

Detailed flag specifications for `resend inboxes` commands.

An inbox is an email address at one of your verified domains that sends and
receives email. Receiving must be enabled on the domain, unless the inbox is
created with `--forwarding`. Received messages are grouped into threads inside
the inbox. Inboxes require a **full-access** API key — sending-only keys
are rejected.

The nested commands take their IDs as positional arguments, parent first: the
inbox ID, then the thread, draft, or label ID, then the email ID. Each ID also
has a flag, such as `--inbox-id`. Pass an ID as an argument or as a flag, not
both, or the command returns `invalid_options`. The IDs are required in
non-interactive mode. Put the arguments before variadic flags such as `--to`.
CLI 2.24.0 used snake_case flags (`--inbox_id`, `--start_date`). They still
work but are hidden from help. Use the kebab-case flags.

---

## inboxes create

Create a new inbox at one of your verified domains.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--email-address <address>` | string | Yes (non-interactive) | Address for the inbox, e.g. `support@yourdomain.com` |
| `--name <name>` | string | No | Internal name for the inbox, recipients do not see it (max 64 chars) |
| `--from-name <name>` | string | No | Name used when sending from this inbox, e.g. `Ada from Support`. A plain name, not `Name <email>` |
| `--forwarding` | boolean | No | Receive mail without an MX record — Resend generates a `receiving_address` to forward mail to |

The output holds only the inbox ID. Run `inboxes get <id>` to read the other
fields, such as `receiving_address`.

**Output:** `{"object":"inbox","id":"<uuid>"}`

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
| `--name <name>` | string | New internal name for the inbox, recipients do not see it (max 64 chars) |
| `--from-name <name>` | string | New name used when sending from this inbox. A plain name, not `Name <email>`. Pass `""` to clear it |

**Output:** `{"object":"inbox","id":"<uuid>"}`

---

## inboxes threads list

List threads in an inbox (default subcommand of `resend inboxes threads`).
Threads are ordered by newest activity first.

**Arguments:** `[inboxId]` (or `--inbox-id <id>`) — required in non-interactive mode

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--folders <folders...>` | string[] | `inbox`, or `inbox`, `archive`, `sent` with `--labels` | One or more of `inbox`, `archive`, `spam`, `sent`, `trash` |
| `--labels <label-ids...>` | string[] | — | One or more label **UUIDs** (not names); returns threads with any of them |
| `--read` | boolean | — | Only threads where every email is read; can't combine with `--unread` |
| `--unread` | boolean | — | Only threads with at least one unread email; can't combine with `--read` |
| `--limit <n>` | number | 10 | Max results, 1-100 |
| `--after <cursor>` | string | — | Forward pagination cursor (a thread ID) |
| `--before <cursor>` | string | — | Backward pagination cursor (a thread ID) |

A thread matches a folder when any of its emails is in it. `spam` and `trash`
are only included when you name them.

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"id":"<uuid>","subject":"<subject>"|null,"from":"<sender>"|null,"to":[],"cc":[],"bcc":[],"labels":[],"email_count":1,"has_attachment":false,"has_draft":false,"read":false,"received_at":"<date>","folder":"inbox|archive|spam|sent|trash"}]}`

---

## inboxes threads search

Search threads by text, people, attachments, and dates. Results are ordered by
newest activity first and paginate like `threads list`. Search can be up to
about a minute behind new emails; use `threads list` to browse exactly.
Different flags combine, so a thread must match all of them. `--folders`,
`--labels`, `--read`, and `--unread` apply to the thread; the other filters
must all match the same email in the thread, and that email must itself be in
one of `--folders` (for `sent`, an email the inbox sent). When more than 10,000 threads
match, search covers the 10,000 with the newest matching email.

**Arguments:** `[inboxId]` (or `--inbox-id <id>`) — required in non-interactive mode

| Flag | Type | Description |
|------|------|-------------|
| `--query <text>` | string | Text to find in subject, body, sender, recipients, and attachment names. Every word must match; quote a phrase to match it exactly, prefix a word with `-` to exclude it. Max 256 characters |
| `--from <addresses...>` | string[] | One or more sender addresses or names, partial match (max 20) |
| `--to <addresses...>` | string[] | Recipients, matched like `--from` |
| `--cc <addresses...>` | string[] | Cc recipients, matched like `--from` |
| `--bcc <addresses...>` | string[] | Bcc recipients, matched like `--from` |
| `--has-attachment` | boolean | Only emails with an attachment; can't combine with `--without-attachment` |
| `--without-attachment` | boolean | Only emails without an attachment; can't combine with `--has-attachment` |
| `--start-date <date>` | string | Emails sent on or after this date (`2026-09-01` or ISO 8601) |
| `--end-date <date>` | string | Emails sent on or before this date; a date covers the whole day |

Also takes `--folders`, `--labels`, `--read`, `--unread`, `--limit`, `--after`,
and `--before`, same as `threads list`.

**Output:** same as `threads list`, plus `"matched_email_id":"<uuid>"|null` and
`"highlights"` on each thread. `highlights` only has keys where `--query`
matched (`subject`, `body`, `from`, `to`, `cc`, `bcc`, `attachments`), each an
array of snippets with matches wrapped in `**`, and is `{}` without `--query`.
`threads emails get`, `reply`, and `forward` accept `matched_email_id` as
`--email-id`, but it is not equal to the `id` those commands return.

---

## inboxes threads get

Retrieve a thread's summary. To read its messages, use
`inboxes threads emails list`.

**Arguments:** `[inboxId]` `[threadId]` (or `--inbox-id <id>`, `--thread-id <id>`) — required in non-interactive mode

**Output:** `{"object":"inbox_thread","id":"<uuid>","subject":"<subject>"|null,"folder":"inbox|archive|spam|sent|trash","labels":[],"read":true}`

---

## inboxes threads update

Mark a thread read/unread, move it, or add and remove labels. At least one
option is required. A label ID cannot be both added and removed in the same
request. Removing a label from a thread keeps the label itself. Moving a
thread out of `trash` restores it and clears its deletion deadline. The changes
apply in this order: read, folder, added labels, removed labels. They are not
atomic, so an unknown label leaves the earlier changes applied.

**Arguments:** `[inboxId]` `[threadId]` (or `--inbox-id <id>`, `--thread-id <id>`) — required in non-interactive mode

| Flag | Type | Description |
|------|------|-------------|
| `--read` | boolean | Mark every message in the thread as read |
| `--unread` | boolean | Mark every message in the thread as unread |
| `--folder <folder>` | string | Move to one of `inbox`, `archive`, `spam`, `trash` (`sent` is not a valid target) |
| `--add-label-ids <label-ids...>` | string[] | Label UUIDs to apply to the thread, 1 to 10 |
| `--remove-label-ids <label-ids...>` | string[] | Label UUIDs to remove from the thread, 1 to 10 |

**Output:** `{"object":"inbox_thread","id":"<uuid>","subject":"<subject>"|null,"folder":"<folder>","labels":[],"read":true}`

---

## inboxes threads delete

Move a thread to `trash` and schedule it for deletion in 30 days. This is
reversible. To restore the thread, move it to `inbox`, `archive`, or `spam`
with `threads update --folder`, which also clears the deletion deadline.
`deleted` is `false` when the thread was already in trash.

**Arguments:** `[inboxId]` `[threadId]` (or `--inbox-id <id>`, `--thread-id <id>`) — required in non-interactive mode

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

**Arguments:** `[inboxId]` `[threadId]` (or `--inbox-id <id>`, `--thread-id <id>`) — required in non-interactive mode

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

**Arguments:** `[inboxId]` `[threadId]` `[emailId]` (or `--inbox-id <id>`, `--thread-id <id>`, `--email-id <id>`) — required in non-interactive mode

**Output:** `{"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>"|null,"message_id":"<message-id>"|null,"html":"<html>"|null,"text":"<text>"|null,"attachments":[{"id":"<id>","filename":"<name>"|null,"size":123|null}],"read":true,"received_at":"<date>"}`

---

## inboxes threads emails reply

Reply to a specific email in a thread. The reply is sent from the inbox
address. It goes to the author of the original email, or its Reply-To address
if it has one. If the inbox sent the original email, it goes to that email's
`to` recipients. The total number of recipients cannot exceed 50, counted after
`--reply-all` adds everyone. A reply takes up to 10 attachments, with at most
25 MB of content in total. A URL file counts toward the 10 files only. An
empty file, a blocked file type, or a URL that is not `http` or `https`, or
that points to `localhost`, returns an error.

**Arguments:** `[inboxId]` `[threadId]` `[emailId]` (or `--inbox-id <id>`, `--thread-id <id>`, `--email-id <id>`) — required in non-interactive mode; the email ID comes from `inboxes threads emails list`

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--cc <addresses...>` | string[] | No | Cc addresses. Not copied from the original email, except with `--reply-all`, which merges them without duplicates |
| `--bcc <addresses...>` | string[] | No | Bcc addresses. Not copied from the original email |
| `--text <text>` | string | One of text/html | Plain text reply body |
| `--html <html>` | string | One of text/html | HTML reply body |
| `--subject <subject>` | string | No | Override the reply subject |
| `--attachment <specs...>` | string[] | No | File path or URL to attach, with optional `;cid=`, `;type=`, `;filename=` params, as on `emails send`. Quote values that contain `;` |
| `--attachments-file <path>` | string | No | JSON array of attachment objects (`-` for stdin) |
| `--reply-all` | boolean | No | Reply to everyone on the original email. For a received email: its Reply-To (or its sender), copying the other `To` header addresses and its `cc`. For an email the inbox sent: its Reply-To when it is not the inbox address, otherwise its `to`, copying its other `to` addresses and its `cc`. The inbox address is excluded, duplicates are removed, and Bcc is never copied |
| `--headers <key=value...>` | string[] | No | Custom headers as `key=value` pairs. `In-Reply-To`, `References`, and `Reply-To` are reserved: Resend sets them, and passing any of them, in any letter case, returns an error. A header name cannot be empty, and names and values cannot contain line breaks or null characters |
| `--idempotency-key <key>` | string | No | Deduplicate request |

**Output:** `{"id":"<email-id>"}`, the ID of the sent email. Use it with `emails get`.

---

## inboxes threads emails forward

Forward an email to other recipients from the inbox address.

**Arguments:** `[inboxId]` `[threadId]` `[emailId]` (or `--inbox-id <id>`, `--thread-id <id>`, `--email-id <id>`) — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--to <addresses...>` | string[] | Yes | Recipient addresses |
| `--cc <addresses...>` | string[] | No | Cc addresses |
| `--bcc <addresses...>` | string[] | No | Bcc addresses |
| `--text <text>` | string | No | Plain text note to include |
| `--html <html>` | string | No | HTML note to include |
| `--subject <subject>` | string | No | Override the forwarded subject |
| `--attachment <specs...>` | string[] | No | File path or URL to attach, with optional `;cid=`, `;type=`, `;filename=` params, as on `emails send`. Quote values that contain `;` |
| `--attachments-file <path>` | string | No | JSON array of attachment objects (`-` for stdin) |
| `--headers <key=value...>` | string[] | No | Custom headers as `key=value` pairs. `In-Reply-To`, `References`, and `Reply-To` are reserved: Resend sets them, and passing any of them, in any letter case, returns an error. A header name cannot be empty, and names and values cannot contain line breaks or null characters |
| `--idempotency-key <key>` | string | No | Deduplicate request |

`--to`, `--cc`, and `--bcc` combined cannot exceed 50 recipients. The
attachments of the original email are sent with the forward, together with any
files you add. Together they can have up to 10 files and at most 25 MB of
content. A URL file counts toward the 10 files only. An empty file, a blocked
file type, or a URL that is not `http` or `https`, or that points to
`localhost`, returns an error. An original attachment
that was sent from a URL cannot be forwarded, and the request returns an error.

**Output:** `{"id":"<email-id>"}`, the ID of the sent email. Use it with `emails get`.

---

## inboxes labels list

List all labels in an inbox (not paginated; default subcommand of
`resend inboxes labels`). Use label IDs with `threads update --add-label-ids`
and `threads list --labels`.

**Arguments:** `[inboxId]` (or `--inbox-id <id>`) — required in non-interactive mode

**Alias:** `ls`

**Output:** `{"object":"list","data":[{"id":"<uuid>","name":"<name>","color":"#RRGGBB","created_at":"<date>"}]}`

---

## inboxes labels create

Create a label. An inbox can have up to 100 labels. Label names are unique per
inbox, compared without case. The color is stored in uppercase.

**Arguments:** `[inboxId]` (or `--inbox-id <id>`) — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | Label name, max 64 characters |
| `--color <color>` | string | No | Hex code like `'#E93D82'`, quoted so the shell keeps the `#` (random when omitted) |

**Output:** `{"object":"inbox_label","id":"<uuid>"}`

---

## inboxes labels update

Update a label's name or color. At least one option is required.

**Arguments:** `[inboxId]` `[labelId]` (or `--inbox-id <id>`, `--label-id <id>`) — required in non-interactive mode

| Flag | Type | Description |
|------|------|-------------|
| `--name <name>` | string | New label name |
| `--color <color>` | string | New label color as a hex code (same format as create) |

**Output:** `{"object":"inbox_label","id":"<uuid>"}`

---

## inboxes labels delete

Delete a label. It is removed from every thread that has it.

**Arguments:** `[inboxId]` `[labelId]` (or `--inbox-id <id>`, `--label-id <id>`) — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox_label","id":"<uuid>","deleted":true}`

---

## inboxes drafts list

List drafts in an inbox (default subcommand of `resend inboxes drafts`).

**Arguments:** `[inboxId]` (or `--inbox-id <id>`) — required in non-interactive mode

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results, 1-100 |
| `--after <cursor>` | string | — | Forward pagination cursor (a draft ID) |
| `--before <cursor>` | string | — | Backward pagination cursor (a draft ID) |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>"|null,"snippet":"<text>"|null,"thread_id":"<uuid>"|null,"reply_to_email_id":"<uuid>"|null,"attachments":[{"id":"<uuid>","filename":"<name>","content_type":"<type>","size":123}],"updated_at":"<date>"}]}`

---

## inboxes drafts create

Create a standalone draft, or a reply draft when `--thread-id` and
`--reply-to-email-id` are passed **together**. A reply draft without `--to` is
addressed to the sender of the email it replies to, or to its Reply-To when
set. For an email the inbox sent, it defaults to that email's `to` recipients.
At least one content field, attachments included, is required. Combined recipients cannot exceed 50.
Only one unsent reply draft can target an email. A reply draft for an email
that already has one returns the ID of the existing draft. That request ignores
every other flag, except the attachments, which replace the attachments of the
existing draft. A reply draft created without `--subject` has an empty subject
and gets no `Re:` prefix, so set one before you send it.

**Arguments:** `[inboxId]` (or `--inbox-id <id>`) — required in non-interactive mode

| Flag | Type | Description |
|------|------|-------------|
| `--to <addresses...>` | string[] | Recipient addresses |
| `--cc <addresses...>` | string[] | Cc addresses |
| `--bcc <addresses...>` | string[] | Bcc addresses |
| `--subject <subject>` | string | Draft subject |
| `--text <text>` | string | Plain text body |
| `--html <html>` | string | HTML body |
| `--thread-id <id>` | string | Thread to reply to (pairs with `--reply-to-email-id`) |
| `--reply-to-email-id <id>` | string | Email the draft replies to (pairs with `--thread-id`) |
| `--idempotency-key <key>` | string | Deduplicate request |
| `--attachment <specs...>` | string[] | Local file to attach with `;type=<MIME type>` and an optional `;filename=`. Quote values that contain `;` |
| `--attachments-file <path>` | string | JSON array of objects with `content` (base64), `filename`, and `content_type` (`-` for stdin) |

Draft attachments need `content`, `filename`, and `content_type`. A URL or a
`;cid=` returns an error. The files on a draft can total at most 25 MB. An
empty file or a blocked file type, such as `.exe`, returns an error.

**Output:** `{"object":"inbox_draft","id":"<uuid>"}`

---

## inboxes drafts get

Retrieve a draft, including its full body.

**Arguments:** `[inboxId]` `[draftId]` (or `--inbox-id <id>`, `--draft-id <id>`) — required in non-interactive mode

**Output:** `{"object":"inbox_draft","id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>"|null,"html":"<html>"|null,"text":"<text>"|null,"thread_id":"<uuid>"|null,"reply_to_email_id":"<uuid>"|null,"email_id":"<uuid>"|null,"attachments":[{"id":"<uuid>","filename":"<name>","content_type":"<type>","size":123}],"created_at":"<date>","updated_at":"<date>"}`

---

## inboxes drafts update

Update a draft's recipients, subject, or body. At least one option is
required; provided fields replace existing values. Setting `--text` or
`--html` replaces the whole body, so the body part you omit becomes `null`. A
draft that was already sent returns an error. Same flags as `drafts create`
minus `--thread-id`, `--reply-to-email-id`, and `--idempotency-key`, plus the
clear flags below.
`--attachment` and `--attachments-file` replace every attachment on the draft.
`--clear-attachments` removes them all. Omit all three to keep them.

| Flag | Description |
|------|-------------|
| `--clear-to` | Sets `to` to `null` |
| `--clear-cc` | Sets `cc` to `null` |
| `--clear-bcc` | Sets `bcc` to `null` |
| `--clear-subject` | Sets `subject` to `null` |
| `--clear-text` | Sets `text` to `null`. Like `--text`, it replaces the whole body |
| `--clear-html` | Sets `html` to `null`. Like `--html`, it replaces the whole body |
| `--clear-attachments` | Removes every attachment |

A clear flag and a value for the same field, such as `--clear-to` with `--to`,
return `invalid_options`.

**Arguments:** `[inboxId]` `[draftId]` (or `--inbox-id <id>`, `--draft-id <id>`) — required in non-interactive mode

**Output:** same shape as `drafts get`.

---

## inboxes drafts delete

Discard an unsent draft. A draft that was already sent returns an error.

**Arguments:** `[inboxId]` `[draftId]` (or `--inbox-id <id>`, `--draft-id <id>`) — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"inbox_draft","id":"<uuid>","deleted":true}`

---

## inboxes drafts send

Send a draft from the inbox address. A reply draft is sent in its thread. A
draft without a thread starts a new thread. The draft must have at least one
`to` recipient, a non-empty subject, and `html` or `text`. A draft that was
already sent returns an error.

**Arguments:** `[inboxId]` `[draftId]` (or `--inbox-id <id>`, `--draft-id <id>`) — required in non-interactive mode

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--headers <key=value...>` | string[] | No | Custom headers as `key=value` pairs. `In-Reply-To`, `References`, and `Reply-To` are reserved: Resend sets them, and passing any of them, in any letter case, returns an error. A header name cannot be empty, and names and values cannot contain line breaks or null characters |
| `--idempotency-key <key>` | string | No | Deduplicate request |

**Output:** `{"id":"<email-id>"}`, the ID of the sent email. Use it with `emails get`.

---

## inboxes agent get

Retrieve an inbox's agent settings (default subcommand of `resend inboxes agent`).
An inbox without a configured agent returns empty settings.

**Arguments:** `[inboxId]` (or `--inbox-id <id>`) — required in non-interactive mode

**Output:** `{"object":"inbox_agent","instructions":"<text>"|null,"tone":"<tone>"|null,"enabled_actions":["draft_reply"]}`

`tone` is a preset key (`concise_professional`, `concise_casual`, `expanded_professional`, `expanded_casual`), custom text, or `null`. Older dashboard values such as `Concise · Casual` are custom text.

---

## inboxes agent update

Update an inbox's agent settings. At least one option is required. Omitted
fields keep their current value.

**Arguments:** `[inboxId]` (or `--inbox-id <id>`) — required in non-interactive mode

| Flag | Type | Description |
|------|------|-------------|
| `--instructions <text>` | string | Instructions the agent follows (max 4000 chars). Pass `""` to clear them |
| `--tone <tone>` | string | Tone the agent writes in. One of the presets `concise_professional`, `concise_casual`, `expanded_professional`, `expanded_casual`, or custom text such as `friendly and concise` (max 64 chars). Pass `""` to clear it |
| `--enabled-actions <actions...>` | string[] | Replaces the whole set (comma or space-separated). Duplicates are removed. One or more of `draft_reply`, `forward_thread`, `add_labels`, `assign_thread`, `mark_as_spam`, `archive_thread`, `delete_thread`. Pass `""` to disable all actions |

**Output:** `{"object":"inbox_agent","id":"<uuid>"}`

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
