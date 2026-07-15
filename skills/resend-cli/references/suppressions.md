# suppressions

Detailed flag specifications for `resend suppressions` commands.

> **Beta:** Suppressions is a pre-GA feature gated per account. Commands appear in
> `--help` but return an API error unless the suppression list is enabled for your
> account. Reach out to Resend to join the beta.

Suppressions block future sends to an address. Each entry has an `origin`:

| Origin | Meaning |
|--------|---------|
| `bounce` | Added automatically after a hard bounce |
| `complaint` | Added automatically after a spam complaint |
| `manual` | Added by you via `suppressions add` |

`get` and `delete` accept **either** a suppression ID **or** the email address.

---

## suppressions list

List suppressed addresses (default subcommand — `resend suppressions` alone runs it).

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results, 1-100 |
| `--after <cursor>` | string | — | Forward pagination cursor |
| `--before <cursor>` | string | — | Backward pagination cursor |
| `--origin <origin>` | string | — | Filter: `bounce` \| `complaint` \| `manual` |

**Alias:** `ls`

**Output:** `{"object":"list","has_more":false,"data":[{"object":"suppression","id":"...","email":"...","origin":"bounce|complaint|manual","source_id":"..."|null,"created_at":"..."}]}`

---

## suppressions add

Suppress a single email address (origin `manual`).

**Argument:** `<email>` — email address to suppress (required in non-interactive mode)

**Output:** `{"object":"suppression","id":"..."}`

---

## suppressions get

Retrieve a single suppression.

**Argument:** `<id-or-email>` — suppression ID or the suppressed email address

**Output:** `{"object":"suppression","id":"...","email":"...","origin":"...","source_id":"..."|null,"created_at":"..."}`

---

## suppressions delete

Remove a suppression so Resend can send to the address again.

**Argument:** `<id-or-email>` — suppression ID or the suppressed email address

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

**Output:** `{"object":"suppression","id":"...","deleted":true}`

---

## suppressions batch add

Suppress up to 100 addresses in one request.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--file <path>` | string | Yes (non-interactive) | JSON file with an array of email strings (`-` for stdin) |

**File format:** `["a@example.com", "b@example.com"]`

**Output:** `{"data":[{"object":"suppression","id":"..."}]}`

---

## suppressions batch remove

Remove up to 100 suppressions in one request.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--file <path>` | string | Yes (non-interactive) | JSON file with an array of strings (`-` for stdin) |
| `--ids` | boolean | No | Treat file entries as suppression IDs instead of emails |

**Alias:** `rm`

**File format:** `["a@example.com", "b@example.com"]` (or IDs with `--ids`)

**Output:** `{"data":[{"object":"suppression","id":"...","deleted":true}]}`
