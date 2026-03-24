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
| `--html-file <path>` | string | At least one body flag | Path to HTML file |
| `--text <text>` | string | At least one body flag | Plain-text body |
| `--react-email <path>` | string | At least one body flag | Path to React Email template (.tsx) — bundles and renders to HTML. Compatible with `--text` for plain-text fallback |
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
| `--react-email <path>` | string | Path to React Email template (.tsx) — bundles and renders to HTML |
| `--name <name>` | string | Update internal label |

---

## broadcasts delete

**Argument:** `<id>` — Broadcast ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`
