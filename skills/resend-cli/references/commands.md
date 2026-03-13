# Command Reference

Detailed flag specifications for every `resend` CLI command.

---

## emails send

Send an email via the Resend API.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--from <address>` | string | Yes | Sender address (must be on a verified domain) |
| `--to <addresses...>` | string[] | Yes | Recipient(s), space-separated |
| `--subject <subject>` | string | Yes | Email subject line |
| `--text <text>` | string | One of text/html/html-file | Plain-text body |
| `--html <html>` | string | One of text/html/html-file | HTML body |
| `--html-file <path>` | string | One of text/html/html-file | Path to HTML file |
| `--cc <addresses...>` | string[] | No | CC recipients |
| `--bcc <addresses...>` | string[] | No | BCC recipients |
| `--reply-to <address>` | string | No | Reply-to address |
| `--scheduled-at <datetime>` | string | No | Schedule for later (ISO 8601) |
| `--attachment <paths...>` | string[] | No | File paths to attach |
| `--headers <key=value...>` | string[] | No | Custom headers |
| `--tags <name=value...>` | string[] | No | Email tags |
| `--idempotency-key <key>` | string | No | Deduplicate request |

**Output:** `{"id":"<uuid>"}`

---

## emails get

Retrieve a sent email by ID.

**Argument:** `<id>` — Email UUID

**Output:**
```json
{
  "object": "email",
  "id": "<uuid>",
  "from": "you@domain.com",
  "to": ["user@example.com"],
  "subject": "Hello",
  "last_event": "delivered",
  "created_at": "<iso-date>",
  "scheduled_at": null
}
```

---

## emails list

List sent emails.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination cursor |
| `--before <cursor>` | string | — | Backward pagination cursor |

**Output:** `{"object":"list","data":[...],"has_more":bool}`

---

## emails batch

Send up to 100 emails in a single request.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--file <path>` | string | Yes (non-interactive) | Path to JSON file with email array |
| `--idempotency-key <key>` | string | No | Deduplicate batch |
| `--batch-validation <mode>` | string | No | `strict` (fail all) or `permissive` (partial success) |

**JSON file format:**
```json
[
  {"from":"a@domain.com","to":["b@example.com"],"subject":"Hi","text":"Body"},
  {"from":"a@domain.com","to":["c@example.com"],"subject":"Hi","html":"<b>Body</b>"}
]
```

**Output (success):** `[{"id":"..."},{"id":"..."}]`
**Output (permissive with errors):** `{"data":[{"id":"..."}],"errors":[{"index":1,"message":"..."}]}`

**Constraints:** Max 100 emails. Attachments and `scheduled_at` not supported per-email.

---

## emails cancel

Cancel a scheduled email.

**Argument:** `<id>` — Email UUID

**Output:** `{"object":"email","id":"..."}`

---

## emails update

Update a scheduled email.

**Argument:** `<id>` — Email UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--scheduled-at <datetime>` | string | Yes | New schedule (ISO 8601) |

**Output:** `{"object":"email","id":"..."}`

---

## emails receiving list

List received (inbound) emails. Requires domain receiving enabled.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## emails receiving get

**Argument:** `<id>` — Received email UUID

Returns full email with html, text, headers, `raw.download_url`, and `attachments[]`.

---

## emails receiving attachments

**Argument:** `<emailId>` — Received email UUID

Lists attachments with `id`, `filename`, `size`, `content_type`, `download_url`, `expires_at`.

---

## emails receiving attachment

**Arguments:** `<emailId>` `<attachmentId>`

Returns single attachment object with `download_url`.

---

## emails receiving forward

**Argument:** `<id>` — Received email UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--to <addresses...>` | string[] | Yes | Forward recipients |
| `--from <address>` | string | Yes | Sender address |

**Output:** `{"id":"..."}`

---

## domains list

List all domains.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

**Note:** List does NOT include DNS records. Use `domains get` for full details.

---

## domains create

Create a new domain and receive DNS records to configure.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <domain>` | string | Yes (non-interactive) | Domain name (e.g., `example.com`) |
| `--region <region>` | string | No | `us-east-1` \| `eu-west-1` \| `sa-east-1` \| `ap-northeast-1` |
| `--tls <mode>` | string | No | `opportunistic` (default) \| `enforced` |
| `--sending` | boolean | No | Enable sending (default: enabled) |
| `--receiving` | boolean | No | Enable receiving (default: disabled) |

**Output:** Domain object with `records[]` array of DNS records to configure.

---

## domains get

**Argument:** `<id>` — Domain ID

Returns full domain with `records[]`, `status` (`not_started`|`pending`|`verified`|`failed`|`temporary_failure`), `capabilities`, `region`.

---

## domains verify

Trigger async DNS verification.

**Argument:** `<id>` — Domain ID

**Output:** `{"object":"domain","id":"..."}`

---

## domains update

**Argument:** `<id>` — Domain ID

| Flag | Type | Description |
|------|------|-------------|
| `--tls <mode>` | string | `opportunistic` \| `enforced` |
| `--open-tracking` | boolean | Enable open tracking |
| `--no-open-tracking` | boolean | Disable open tracking |
| `--click-tracking` | boolean | Enable click tracking |
| `--no-click-tracking` | boolean | Disable click tracking |

At least one option required.

---

## domains delete

**Argument:** `<id>` — Domain ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

---

## api-keys list

List all API keys (IDs and names only — tokens never included).

---

## api-keys create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | Key name (max 50 chars) |
| `--permission <perm>` | string | No | `full_access` (default) \| `sending_access` |
| `--domain-id <id>` | string | No | Restrict `sending_access` to one domain |

**Output:** `{"id":"...","token":"re_..."}` — token shown once only.

---

## api-keys delete

**Argument:** `<id>` — API key ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

---

## broadcasts list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## broadcasts create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--from <address>` | string | Yes | Sender address |
| `--subject <subject>` | string | Yes | Email subject |
| `--segment-id <id>` | string | Yes | Target segment |
| `--html <html>` | string | One of html/html-file/text | HTML body (supports `{{{PROPERTY\|fallback}}}`) |
| `--html-file <path>` | string | One of html/html-file/text | Path to HTML file |
| `--text <text>` | string | One of html/html-file/text | Plain-text body |
| `--name <name>` | string | No | Internal label |
| `--reply-to <address>` | string | No | Reply-to address |
| `--preview-text <text>` | string | No | Preview text |
| `--topic-id <id>` | string | No | Topic for subscription filtering |
| `--send` | boolean | No | Send immediately (default: save as draft) |
| `--scheduled-at <datetime>` | string | No | Schedule delivery (only with `--send`) |

---

## broadcasts get

**Argument:** `<id>` — Broadcast ID

Returns full object with html/text, from, subject, status (`draft`|`queued`|`sent`), timestamps.

---

## broadcasts send

Send a draft broadcast.

**Argument:** `<id>` — Broadcast ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--scheduled-at <datetime>` | string | No | Schedule instead of immediate send |

**Note:** Dashboard-created broadcasts cannot be sent via API.

---

## broadcasts update

**Argument:** `<id>` — Broadcast ID (must be draft)

| Flag | Type | Description |
|------|------|-------------|
| `--from <address>` | string | Update sender |
| `--subject <subject>` | string | Update subject |
| `--html <html>` | string | Update HTML body |
| `--html-file <path>` | string | Path to HTML file |
| `--text <text>` | string | Update plain-text body |
| `--name <name>` | string | Update internal label |

---

## broadcasts delete

**Argument:** `<id>` — Broadcast ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

---

## contacts list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## contacts create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--email <email>` | string | Yes | Contact email |
| `--first-name <name>` | string | No | First name |
| `--last-name <name>` | string | No | Last name |
| `--unsubscribed` | boolean | No | Globally unsubscribe |
| `--properties <json>` | string | No | Custom properties JSON |
| `--segment-id <id...>` | string[] | No | Add to segment(s) |

---

## contacts get

**Argument:** `<id|email>` — Contact UUID or email address (both accepted)

---

## contacts update

**Argument:** `<id|email>` — Contact UUID or email address

| Flag | Type | Description |
|------|------|-------------|
| `--unsubscribed` | boolean | Set unsubscribed |
| `--no-unsubscribed` | boolean | Re-subscribe |
| `--properties <json>` | string | Merge properties (set key to `null` to clear) |

---

## contacts delete

**Argument:** `<id|email>` — Contact UUID or email address

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

---

## contacts segments

List segments a contact belongs to.

**Argument:** `<id|email>` — Contact UUID or email

---

## contacts add-segment

**Argument:** `<contactId>` — Contact UUID or email

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--segment-id <id>` | string | Yes (non-interactive) | Segment ID to add to |

---

## contacts remove-segment

**Arguments:** `<contactId>` `<segmentId>`

---

## contacts topics

List contact's topic subscriptions.

**Argument:** `<id|email>` — Contact UUID or email

---

## contacts update-topics

**Argument:** `<id|email>` — Contact UUID or email

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--topics <json>` | string | Yes (non-interactive) | JSON array: `[{"id":"topic-uuid","subscription":"opt_in"}]` |

Subscription values: `opt_in` | `opt_out`

---

## contact-properties list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## contact-properties create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--key <key>` | string | Yes (non-interactive) | Property key name |
| `--type <type>` | string | Yes (non-interactive) | `string` \| `number` |
| `--fallback-value <value>` | string | No | Default in templates |

Reserved keys: `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `UNSUBSCRIBE_URL`

---

## contact-properties get

**Argument:** `<id>` — Property UUID

---

## contact-properties update

**Argument:** `<id>` — Property UUID

| Flag | Type | Description |
|------|------|-------------|
| `--fallback-value <value>` | string | New fallback |
| `--clear-fallback-value` | boolean | Remove fallback (mutually exclusive with above) |

Key and type are immutable after creation.

---

## contact-properties delete

**Argument:** `<id>` — Property UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Warning:** Removes property from ALL contacts permanently.

---

## segments list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## segments create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | Segment name |

---

## segments get

**Argument:** `<id>` — Segment UUID

---

## segments delete

**Argument:** `<id>` — Segment UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

Deleting a segment does NOT delete its contacts.

---

## templates list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## templates create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes | Template name |
| `--html <html>` | string | One of html/html-file | HTML body with `{{{VAR_NAME}}}` placeholders |
| `--html-file <path>` | string | One of html/html-file | Path to HTML file |
| `--subject <subject>` | string | No | Email subject |
| `--text <text>` | string | No | Plain-text body |
| `--from <address>` | string | No | Sender address |
| `--reply-to <address>` | string | No | Reply-to address |
| `--alias <alias>` | string | No | Lookup alias |
| `--var <var...>` | string[] | No | Variables: `KEY:type` or `KEY:type:fallback` |

Variable types: `string`, `number`

---

## templates get

**Argument:** `<id|alias>` — Template ID or alias

---

## templates update

**Argument:** `<id|alias>` — Template ID or alias

Same optional flags as `create`. At least one required.

---

## templates publish

**Argument:** `<id|alias>` — Promotes draft to published.

---

## templates duplicate

**Argument:** `<id|alias>` — Creates a copy as draft.

---

## templates delete

**Argument:** `<id|alias>`

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

---

## topics list

Lists all topics. No pagination flags.

---

## topics create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | Topic name |
| `--description <desc>` | string | No | Description |
| `--default-subscription <mode>` | string | No | `opt_in` (default) \| `opt_out` |

---

## topics get

**Argument:** `<id>` — Topic UUID

---

## topics update

**Argument:** `<id>` — Topic UUID

| Flag | Type | Description |
|------|------|-------------|
| `--name <name>` | string | New name |
| `--description <desc>` | string | New description |

`default_subscription` cannot be changed after creation.

---

## topics delete

**Argument:** `<id>` — Topic UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

---

## webhooks list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## webhooks create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--endpoint <url>` | string | Yes (non-interactive) | HTTPS webhook URL |
| `--events <events...>` | string[] | Yes (non-interactive) | Event types or `all` |

**All 17 events:**
- Email: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, `email.scheduled`, `email.suppressed`, `email.received`
- Contact: `contact.created`, `contact.updated`, `contact.deleted`
- Domain: `domain.created`, `domain.updated`, `domain.deleted`

**Output includes `signing_secret`** — shown once only. Save immediately.

---

## webhooks get

**Argument:** `<id>` — Webhook UUID

**Note:** `signing_secret` is NOT returned by get (only at creation).

---

## webhooks update

**Argument:** `<id>` — Webhook UUID

| Flag | Type | Description |
|------|------|-------------|
| `--endpoint <url>` | string | New HTTPS URL |
| `--events <events...>` | string[] | Replace event list (not additive) |
| `--status <status>` | string | `enabled` \| `disabled` |

---

## webhooks delete

**Argument:** `<id>` — Webhook UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

---

## auth login

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--key <key>` | string | Yes (non-interactive) | API key (must start with `re_`) |

---

## auth logout

Removes the active profile's credentials (or all profiles if no `--profile`).

---

## auth list

Lists all profiles with active marker.

---

## auth switch

**Argument:** `[name]` — Profile name (prompts in interactive if omitted)

---

## auth rename

**Arguments:** `[old-name]` `[new-name]` — Prompts in interactive if omitted

---

## auth remove

**Argument:** `[name]` — Profile name (prompts in interactive if omitted)

---

## whoami

No flags. Shows authentication status (local only, no network calls).

---

## doctor

Checks: CLI Version, API Key, Domains, AI Agents.

Exits `0` if all pass/warn, `1` if any fail.

---

## update

Checks GitHub releases for newer version. Shows upgrade command.

---

## open

Opens `https://resend.com/emails` in the default browser.
