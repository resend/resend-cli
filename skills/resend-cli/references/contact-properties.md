# contact-properties

Detailed flag specifications for `resend contact-properties` commands.

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
| `--fallback-value <value>` | string \| number | No | Default in templates (parsed as number when `--type number`) |

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
