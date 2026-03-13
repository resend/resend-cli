# segments

Detailed flag specifications for `resend segments` commands.

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
