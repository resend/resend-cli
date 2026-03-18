# domains

Detailed flag specifications for `resend domains` commands.

---

## domains list

List all domains.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

**Note:** List does NOT include DNS records. Use `domains get` for full details.

---

## domains create

Create a new domain and receive DNS records to configure.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <domain>` | string | Yes (non-interactive) | Domain name (e.g., `example.com`) |
| `--region <region>` | string | No | `us-east-1` \| `eu-west-1` \| `sa-east-1` \| `ap-northeast-1` |
| `--tls <mode>` | string | No | `opportunistic` (default) \| `enforced` |
| `--sending` | boolean | No | Enable sending (default: enabled) |
| `--receiving` | boolean | No | Enable receiving (default: disabled) |

**Output:** Domain object with `records[]` array of DNS records to configure.

---

## domains get

**Argument:** `<id>` — Domain ID

Returns full domain with `records[]`, `status` (`not_started`|`pending`|`verified`|`failed`|`temporary_failure`), `capabilities`, `region`.

---

## domains verify

Trigger async DNS verification.

**Argument:** `<id>` — Domain ID

**Output:** `{"object":"domain","id":"..."}`

---

## domains update

**Argument:** `<id>` — Domain ID

| Flag | Type | Description |
|------|------|-------------|
| `--tls <mode>` | string | `opportunistic` \| `enforced` |
| `--open-tracking` | boolean | Enable open tracking |
| `--no-open-tracking` | boolean | Disable open tracking |
| `--click-tracking` | boolean | Enable click tracking |
| `--no-click-tracking` | boolean | Disable click tracking |

At least one option required.

---

## domains delete

**Argument:** `<id>` — Domain ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`
