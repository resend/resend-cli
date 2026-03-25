# emails

Detailed flag specifications for `resend emails` commands.

---

## emails send

Send an email via the Resend API.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--from <address>` | string | Yes (unless `--template`) | Sender address (must be on a verified domain) |
| `--to <addresses...>` | string[] | Yes | Recipient(s), space-separated |
| `--subject <subject>` | string | Yes (unless `--template`) | Email subject line |
| `--text <text>` | string | One of text/html/file/react-email/template | Plain-text body |
| `--text-file <path>` | string | One of text/html/file/react-email/template | Path to plain-text file (use `"-"` for stdin) |
| `--html <html>` | string | One of text/html/file/react-email/template | HTML body |
| `--html-file <path>` | string | One of text/html/file/react-email/template | Path to HTML file (use `"-"` for stdin) |
| `--react-email <path>` | string | One of text/html/file/react-email/template | Path to React Email template (.tsx) — bundles, renders to HTML, and sends |
| `--template <id>` | string | No | Template ID — replaces body/subject/from with template defaults |
| `--var <key=value...>` | string[] | No | Template variables as key=value pairs (e.g. `--var name=John --var count=42`) |
| `--cc <addresses...>` | string[] | No | CC recipients |
| `--bcc <addresses...>` | string[] | No | BCC recipients |
| `--reply-to <address>` | string | No | Reply-to address |
| `--scheduled-at <datetime>` | string | No | Schedule for later — ISO 8601 or natural language (e.g. `"in 1 hour"`, `"tomorrow at 9am ET"`) |
| `--attachment <paths...>` | string[] | No | File paths to attach (not compatible with `--template`) |
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
| `--react-email <path>` | string | No | Path to React Email template (.tsx) — rendered HTML is set on every email in the batch |
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
| `--scheduled-at <datetime>` | string | Yes | New schedule — ISO 8601 or natural language |

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

## emails receiving listen

Poll for new inbound emails and display them as they arrive. Long-running command; Ctrl+C exits cleanly.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--interval <seconds>` | number | 5 | Polling interval in seconds (minimum 2) |

**Behavior:**
- Interactive: one-line-per-email display (timestamp, from, to, subject, id)
- Piped / `--json`: NDJSON (one JSON object per line)
- Exits after 5 consecutive API failures
