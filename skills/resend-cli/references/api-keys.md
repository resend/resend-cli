# api-keys

Detailed flag specifications for `resend api-keys` commands.

---

## api-keys list

List all API keys (IDs, names, `created_at`, and `last_used_at` — tokens never included).

**Output:** `{"object":"list","data":[{"id":"...","name":"...","created_at":"...","last_used_at":"..."|null}]}`

---

## api-keys create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | Key name |
| `--permission <perm>` | string | No | `full_access` (default) \| `sending_access` |
| `--domain-id <id>` | string | No | Restrict `sending_access` to one domain |

**Output:** `{"id":"...","token":"re_..."}` — token shown once only.

---

## api-keys update

Rename an API key.

**Argument:** `[id]` — API key ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (non-interactive) | New key name |

**Output:** `{"object":"api_key","id":"..."}`

---

## api-keys delete

**Argument:** `<id>` — API key ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`
