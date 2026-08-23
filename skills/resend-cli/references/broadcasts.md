# broadcasts

Detailed flag specifications for `resend broadcasts` commands.

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
| `--html <html>` | string | At least one body flag | HTML body (supports `{{{PROPERTY\|fallback}}}`) |
| `--html-file <path>` | string | At least one body flag | Path to HTML file (use `"-"` for stdin) |
| `--text <text>` | string | At least one body flag | Plain-text body |
| `--react-email <path>` | string | At least one body flag | Path to React Email template (.tsx) — bundles and renders to HTML. Compatible with `--text` for plain-text fallback |
| `--text-file <path>` | string | At least one body flag | Path to plain-text file (use `"-"` for stdin) |
| `--name <name>` | string | No | Internal label |
| `--reply-to <address>` | string | No | Reply-to address |
| `--preview-text <text>` | string | No | Preview text |
| `--topic-id <id>` | string | No | Topic for subscription filtering |
| `--send` | boolean | No | Send immediately (default: save as draft) |
| `--scheduled-at <datetime>` | string | No | Schedule delivery — ISO 8601 or natural language (only with `--send`) |

---

## broadcasts get

**Argument:** `<id>` — Broadcast ID

Returns full object with html/text, from, subject, status (`draft`|`queued`|`sent`), timestamps.

---

## broadcasts recipients

**Argument:** `[id]` — Broadcast ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--type <type>` | string | Yes (non-interactive) | Event to filter by: `sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained`, `unsubscribed`, `suppressed` |
| `--email <email>` | string | No | Substring filter on recipient email |
| `--bounce-type <type>` | string | No | Bounce classification: `permanent`, `transient`, `undetermined` — only meaningful when `--type bounced` |
| `--limit <n>` | number | No | Max results (1-100, default 20) |
| `--after <cursor>` | string | No | Forward pagination |
| `--before <cursor>` | string | No | Backward pagination |

Returns `id` (opaque pagination cursor), `contact_id` (nullable), `email`, and, depending on `--type`: `count` (`opened`/`clicked`), `bounce_type` (`bounced`), `clicked_links` (`clicked`).

**Note:** Responses are cached for up to 15 minutes, so requesting the same page again may return slightly stale data within that window.

---

## broadcasts send

Send a draft broadcast.

**Argument:** `<id>` — Broadcast ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--scheduled-at <datetime>` | string | No | Schedule instead of immediate send — ISO 8601 or natural language |

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
| `--react-email <path>` | string | Path to React Email template (.tsx) — bundles and renders to HTML |
| `--name <name>` | string | Update internal label |

---

## broadcasts cancel

Cancel a queued or scheduled broadcast without removing it.

**Argument:** `<id>` — Broadcast ID

Cancelling a queued broadcast stops it mid-send — emails already sent are not affected. Cancelling a scheduled broadcast reverts it to draft. Draft and sent broadcasts cannot be cancelled.

---

## broadcasts delete

**Argument:** `<id>` — Broadcast ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

---

## broadcasts open

Open a broadcast (or the broadcasts list) in the Resend dashboard.

**Argument:** `[id]` — Broadcast ID (omit to open the list)

---

## broadcasts clicked-links

List the links clicked in a broadcast, ranked by total clicks.

**Argument:** `[id]` — Broadcast ID

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |
