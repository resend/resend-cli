# topics

Detailed flag specifications for `resend topics` commands.

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

At least one of `--name` or `--description` is required — otherwise the CLI errors with `no_changes`.

`default_subscription` cannot be changed after creation.

---

## topics delete

**Argument:** `<id>` — Topic UUID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |
