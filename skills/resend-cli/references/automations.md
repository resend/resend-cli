# automations & events

Detailed flag specifications for `resend automations` and `resend events` commands.

---

## automations list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## automations create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes (unless in `--file`) | Automation name |
| `--status <status>` | string | No | Initial status: `enabled` or `disabled` |
| `--steps <json>` | string | Yes (unless `--file`) | Steps array as JSON string |
| `--connections <json>` | string | Yes (unless `--file`) | Connections array as JSON string |
| `--file <path>` | string | No | Path to JSON file with full payload (use `"-"` for stdin) |

When using `--file`, the JSON object should contain `{ name, status?, steps, connections }`. Flags override file values.

**Step types:** `trigger`, `delay`, `send_email`, `wait_for_event`, `condition`

**Connection types:** `default`, `condition_met`, `condition_not_met`, `timeout`, `event_received`

---

## automations get

```
resend automations get <id>
```

Returns the full automation object including steps and connections.

---

## automations update

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--status <status>` | string | Yes | `enabled` or `disabled` |

```
resend automations update <id> --status enabled
```

---

## automations stop

```
resend automations stop <id>
```

Stops a running automation by setting its status to disabled and cancelling active runs.

Returns `{"object":"automation","id":"<id>","status":"disabled"}`.

---

## automations delete

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

---

## automations open

```
resend automations open [id]
```

Opens the automations list or a specific automation's editor in the dashboard.

---

## automations runs

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--status <status>` | string | — | Filter by status (comma-separated: `running`, `completed`, `failed`, `cancelled`) |
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

```
resend automations runs <automation-id>
resend automations runs list <automation-id> --status running
resend automations runs list <automation-id> --status completed,failed
```

**Run status values:** `running` | `completed` | `failed` | `cancelled`

---

## automations runs get

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--automation-id <id>` | string | Yes | Automation ID |
| `--run-id <id>` | string | Yes | Run ID |

Returns the full run object including step-level execution details.

---

## events list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## events create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | Yes | Event name (e.g. `user.signed_up`) |
| `--schema <json>` | string | No | JSON object mapping field names to types (`string`, `number`, `boolean`, `date`) |

Event names cannot start with `resend:` (reserved).

---

## events get

```
resend events get <id>
```

Accepts an event ID.

---

## events update

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--schema <json>` | string | Yes | Updated schema JSON (pass `null` to clear) |

---

## events delete

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

---

## events send

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--event <name>` | string | Yes | Event name to trigger |
| `--contact-id <id>` | string | One of `--contact-id` or `--email` | Contact ID |
| `--email <address>` | string | One of `--contact-id` or `--email` | Contact email |
| `--payload <json>` | string | No | JSON payload matching the event schema |

---

## events open

```
resend events open
```

Opens the events management page in the dashboard.
