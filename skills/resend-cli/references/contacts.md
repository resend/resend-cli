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

---

## contacts imports create

Bulk-import contacts from a local CSV file. The file is uploaded as multipart form data (max 100MB). Imports run **asynchronously** — the command returns an import id immediately while the file is processed in the background (poll with `contacts imports get`).

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--file <path>` | string | Yes (non-interactive) | Path to the CSV file to import |
| `--column-map <json>` | string | No | JSON object mapping contact fields to CSV column headers: `{"email":"Email","firstName":"First Name","properties":{"plan":{"column":"Plan","type":"string"}}}` |
| `--on-conflict <strategy>` | string | No | How to handle existing contacts: `upsert` (default, updates) or `skip` |
| `--segment-id <id...>` | string[] | No | Add imported contacts to segment(s) — repeatable |
| `--topics <json>` | string | No | JSON array: `[{"id":"topic-uuid","subscription":"opt_in"}]` |

Mappable contact fields: `email`, `firstName`, `lastName`, `unsubscribed`, `properties`.

Without `--column-map`, columns are matched by the lowercase names `email` (required), `first_name`, `last_name` — matching is **case-sensitive**, so a CSV with `Email`/`First Name` headers fails with `create_error` (422 "missing required email column"). Use `--column-map` to import such a file.

---

## contacts imports get

Retrieve a contact import's status and counts.

**Argument:** `[id]` — Contact import ID (interactive picker when omitted)

Status values: `queued` | `in_progress` | `completed` | `failed`

---

## contacts imports list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |
| `--status <status>` | string | — | Filter by status: `queued` \| `in_progress` \| `completed` \| `failed` |

**Alias:** `ls`
