# webhooks

Detailed flag specifications for `resend webhooks` commands.

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

**Argument:** `<id>` — Webhook ID

**Note:** `signing_secret` is NOT returned by get (only at creation).

---

## webhooks update

**Argument:** `<id>` — Webhook ID

| Flag | Type | Description |
|------|------|-------------|
| `--endpoint <url>` | string | New HTTPS URL |
| `--events <events...>` | string[] | Replace event list (not additive) |
| `--status <status>` | string | `enabled` \| `disabled` |

---

## webhooks delete

**Argument:** `<id>` — Webhook ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

---

## webhooks listen

Start a local server that receives Resend webhook events in real time via a public tunnel URL.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--url <url>` | string | — | Public tunnel URL for receiving webhooks (required in non-interactive) |
| `--forward-to <url>` | string | — | Forward payloads to this local URL (preserves Svix headers) |
| `--events <events...>` | string[] | all | Event types to listen for |
| `--port <port>` | number | 4318 | Local server port |

**Behavior:**
1. Starts a local HTTP server on `--port`
2. Registers a temporary Resend webhook pointing at `--url`
3. Displays incoming events in the terminal
4. Optionally forwards payloads to `--forward-to` with original Svix headers
5. Deletes the temporary webhook on exit (Ctrl+C)
