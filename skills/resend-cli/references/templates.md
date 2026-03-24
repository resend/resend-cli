# templates

Detailed flag specifications for `resend templates` commands.

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
| `--html <html>` | string | One of html/html-file/react-email | HTML body with `{{{VAR_NAME}}}` placeholders |
| `--html-file <path>` | string | One of html/html-file/react-email | Path to HTML file |
| `--react-email <path>` | string | One of html/html-file/react-email | Path to React Email template (.tsx) — bundles and renders to HTML |
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

Same optional flags as `create` (including `--react-email`). At least one required.

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
