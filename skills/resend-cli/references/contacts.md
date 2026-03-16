# contacts

Detailed flag specifications for `resend contacts` commands.

---

## contacts list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## contacts create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--email <email>` | string | Yes | Contact email |
| `--first-name <name>` | string | No | First name |
| `--last-name <name>` | string | No | Last name |
| `--unsubscribed` | boolean | No | Globally unsubscribe |
| `--properties <json>` | string | No | Custom properties JSON |
| `--segment-id <id...>` | string[] | No | Add to segment(s) |

---

## contacts get

**Argument:** `<id|email>` — Contact UUID or email address (both accepted)

---

## contacts update

**Argument:** `<id|email>` — Contact UUID or email address

| Flag | Type | Description |
|------|------|-------------|
| `--unsubscribed` | boolean | Set unsubscribed |
| `--no-unsubscribed` | boolean | Re-subscribe |
| `--properties <json>` | string | Merge properties (set key to `null` to clear) |

---

## contacts delete

**Argument:** `<id|email>` — Contact UUID or email address

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

---

## contacts segments

List segments a contact belongs to.

**Argument:** `<id|email>` — Contact UUID or email

---

## contacts add-segment

**Argument:** `<contactId>` — Contact UUID or email

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--segment-id <id>` | string | Yes (non-interactive) | Segment ID to add to |

---

## contacts remove-segment

**Arguments:** `<id|email>` `<segmentId>`

---

## contacts topics

List contact's topic subscriptions.

**Argument:** `<id|email>` — Contact UUID or email

---

## contacts update-topics

**Argument:** `<id|email>` — Contact UUID or email

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--topics <json>` | string | Yes (non-interactive) | JSON array: `[{"id":"topic-uuid","subscription":"opt_in"}]` |

Subscription values: `opt_in` | `opt_out`
