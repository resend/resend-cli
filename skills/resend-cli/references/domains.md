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
| `--tracking-subdomain <subdomain>` | string | No | Subdomain for click and open tracking (e.g., `track`) |
| `--sending` | boolean | No | Enable sending (default: enabled) |
| `--receiving` | boolean | No | Enable receiving (default: disabled) |

**Output:** Domain object with `records[]` array of DNS records to configure.

---

## domains get

**Argument:** `<id>` — Domain ID

Returns full domain with `records[]`, `status` (`not_started`|`pending`|`verified`|`failed`|`temporary_failure`), `capabilities`, `region`, `open_tracking`, `click_tracking`, `tracking_subdomain`. Records may include a `Tracking` CNAME record when a tracking subdomain is configured, and a `TrackingCAA` CAA record when the root domain has CAA records that require an additional entry for AWS certificate issuance.

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
| `--tracking-subdomain <subdomain>` | string | Subdomain for click and open tracking (e.g., `track`) |

At least one option required.

---

## domains delete

**Argument:** `<id>` — Domain ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

**Alias:** `rm`

---

## domains claim

Claim a domain that **another Resend account has already verified**. The domain transfers to your account as a brand-new domain with fresh DKIM keys, so the previous account's DNS records can't be reused.

**Lifecycle:**
1. `resend domains claim create --name example.com` — returns the TXT record to add
2. Add the TXT record at your DNS provider
3. `resend domains claim verify <domain-id>` — trigger verification + transfer
4. `resend domains claim get <domain-id>` — poll until `completed`
5. The transferred domain has NEW DKIM records — run `resend domains get <domain-id>` for the records, update DNS, then `resend domains verify <domain-id>`

Claim status values: `pending` | `verified` | `completed` | `blocked` | `expired` | `superseded` | `canceled` | `failed`.

### domains claim create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <domain>` | string | Yes (non-interactive) | Domain name to claim (e.g., `example.com`) |
| `--region <region>` | string | No | `us-east-1` \| `eu-west-1` \| `sa-east-1` \| `ap-northeast-1` |
| `--tracking-subdomain <subdomain>` | string | No | Subdomain for click and open tracking (e.g., `track`) |

**Output:** `domain_claim` object with `domain_id` (the placeholder domain) and a TXT `record` to add to DNS.

### domains claim get

**Argument:** `<id>` — Domain ID (the placeholder domain created by the claim)

**Output:** `domain_claim` with `status`, `domain_id`, the TXT `record`, `blocked_reason`, `expires_at`.

### domains claim verify

**Argument:** `<id>` — Domain ID (the placeholder domain created by the claim)

Triggers async verification + transfer. Poll `domains claim get <id>` for status. After `completed`, fetch the new DKIM records with `domains get <id>`, update DNS, then run `domains verify <id>`.
