# webhooks

Detailed flag specifications for `resend webhooks` commands.

---

## webhooks trigger

Generate a Resend-shaped synthetic email event, sign it with
`RESEND_WEBHOOK_SECRET`, and POST it directly to an HTTP(S) endpoint. This
command does not call the Resend API or require `RESEND_API_KEY`, stored
credentials, login, or a profile.

Set a development-only secret explicitly in both the application and CLI
process environments. Generate it once and pass the same value to both; do not
generate a different secret for each process. The CLI does not automatically
load `.env` files:

```sh
export RESEND_WEBHOOK_SECRET="whsec_$(openssl rand -base64 32 | tr -d '\n')"
```

Never reuse a production webhook secret for local testing.

**Argument:** `<event-type>` — required. Supported fixtures are
`email.delivered`, `email.bounced`, and `email.complained`.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--forward-to <url>` | string | Yes | HTTP(S) endpoint; credentials in the URL are rejected |
| `--email-id <id>` | string | No | Override the generated email ID |
| `--message-id <id>` | string | No | Override the generated message ID |
| `--from <address>` | string | No | Override the sender address |
| `--to <addresses...>` | string[] | No | Override recipient addresses |
| `--subject <subject>` | string | No | Override the email subject |
| `--broadcast-id <id>` | string | No | Override the generated broadcast ID |
| `--template-id <id>` | string | No | Override the generated template ID |
| `--tag <name=value...>` | string[] | No | Replace generated tags; repeat for multiple tags |
| `--event-created-at <timestamp>` | ISO 8601 | No | Override the event creation time |
| `--email-created-at <timestamp>` | ISO 8601 | No | Override the email creation time |
| `--bounce-type <type>` | string | No | Override bounce type (`email.bounced` only) |
| `--bounce-sub-type <subtype>` | string | No | Override bounce subtype (`email.bounced` only) |
| `--bounce-message <message>` | string | No | Override bounce message (`email.bounced` only) |
| `--delivery-id <id>` | string | No | Reuse a delivery ID to exercise app-level deduplication |
| `--dry-run` | boolean | No | Show the prepared POST without sending it |

The generated event uses fake, coherent values for email and message IDs,
sender, recipient, subject, timestamps, broadcast/template IDs, and tags. Bounce
events also get synthetic bounce details. The payload follows the event examples
and SDK event types; it does not emulate Resend's service-side delivery process.
When `--tag` is supplied, it replaces the generated tag map. Bounce options are
only valid with `email.bounced`.

```sh
resend webhooks trigger email.delivered --forward-to http://localhost:3000/webhooks/resend
resend webhooks trigger email.bounced --forward-to http://localhost:3000/webhooks/resend
resend webhooks trigger email.complained --forward-to http://localhost:3000/webhooks/resend
resend webhooks trigger email.delivered --forward-to http://localhost:3000/webhooks/resend --email-id 56761188-7520-42d8-8898-ff6fc54ce618 --to user@example.test
resend webhooks trigger email.delivered --forward-to http://localhost:3000/webhooks/resend --tag category=transactional --tag order_id=123
resend webhooks trigger email.bounced --forward-to http://localhost:3000/webhooks/resend --bounce-type Transient --bounce-sub-type MailboxFull
resend webhooks trigger email.bounced --forward-to http://localhost:3000/webhooks/resend --delivery-id msg_local_repeatable_1
resend webhooks trigger email.delivered --forward-to http://localhost:3000/webhooks/resend --dry-run
```

For CI, provide the same development secret to the app and the CLI. Set
`RESEND_TELEMETRY_DISABLED=1` and `RESEND_NO_UPDATE_NOTIFIER=1` to disable the
CLI's optional telemetry and update-check network requests. `--json` returns a
result with `synthetic`, `event_type`, `delivery_id`, `http_status`,
`duration_ms`, `response_body`, and `response_truncated`.

An HTTP 2xx only confirms the endpoint's HTTP response, not completion of the
application's business logic. The command does not send or validate real email,
test DNS, a public HTTPS endpoint, tunnels, or Resend reachability; it does not
reproduce Resend retries or create API-queryable resources. If the handler
fetches the synthetic email or related resource from the API, provide a mock or
a real test resource. Handlers can still create real side effects if connected
to real data or services, so use a development environment. This MVP does not
include `email.received` or inbox event fixtures.

`trigger` sends a synthetic event directly to a URL. `listen` creates a
temporary Resend webhook and receives actual events through a public tunnel.
`events replay` asks Resend to redeliver an existing event.

---

## webhooks list

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

---

## webhooks create

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--endpoint <url>` | string | Yes (non-interactive) | HTTPS webhook URL |
| `--events <events...>` | string[] | Yes (non-interactive) | Event types or `all` |

**All 37 events:**
- Email: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed`, `email.scheduled`, `email.suppressed`, `email.received`
- Contact: `contact.created`, `contact.updated`, `contact.deleted`, `contact.topics.updated`
- Domain: `domain.created`, `domain.updated`, `domain.deleted`
- Suppression: `suppression.added`, `suppression.removed`
- Topic: `topic.created`, `topic.updated`, `topic.deleted`
- Inbox: `inbox.created`, `inbox.updated`, `inbox.deleted`, `inbox.thread.created`, `inbox.email.received`, `inbox.email.sent`, `inbox.thread.folder.updated`, `inbox.thread.assigned`, `inbox.thread.unassigned`, `inbox.thread.labels.updated`, `inbox.draft.created`, `inbox.draft.updated`, `inbox.draft.sent`, `inbox.draft.deleted`

**Output includes `signing_secret`.** `webhooks get` returns it again.

---

## webhooks get

**Argument:** `<id>` — Webhook ID

Returns the webhook including its `signing_secret`.

---

## webhooks update

**Argument:** `<id>` — Webhook ID

| Flag | Type | Description |
|------|------|-------------|
| `--endpoint <url>` | string | New HTTPS URL |
| `--events <events...>` | string[] | Replace event list (not additive) |
| `--status <status>` | string | `enabled` \| `disabled` |

---

## webhooks delete

**Argument:** `<id>` — Webhook ID

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--yes` | boolean | Yes (non-interactive) | Skip confirmation |

---

## webhooks rotate-signing-secret

**Argument:** `<id>` — Webhook ID

Generates a new signing secret. For 24 hours, payloads are signed with both the
new and the previous secret, so either one verifies them. After that, only the
new secret does.

Returns `{"object":"webhook","id":"<uuid>","signing_secret":"whsec_..."}`.

---

## webhooks events list

Lists the events Resend delivered to a webhook, most recent first.

**Argument:** `[webhookId]` — Webhook ID

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination (an event ID) |

**No `--before`.** These endpoints paginate forward only.

**`status` values:** `pending`, `attempting`, `success`, `failed`.

---

## webhooks events get

**Arguments:** `[webhookId]` `[eventId]`

Returns the event with `next_attempt_at` and the `payload` that was sent to your endpoint.
`next_attempt_at` is `null` once the event reaches `success` or `failed`.

---

## webhooks events attempts

Lists the delivery attempts for one event, most recent first. Each attempt records the
`http_status_code` and `response` body your endpoint returned.

**Arguments:** `[webhookId]` `[eventId]`

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination (an attempt ID) |

**Debugging a failed delivery:**
1. `resend webhooks events list <webhook-id>` — find the event
2. `resend webhooks events get <webhook-id> <event-id>` — see what we sent
3. `resend webhooks events attempts <webhook-id> <event-id>` — see what your endpoint returned
4. `resend webhooks events replay <webhook-id> <event-id>` — queue another delivery

---

## webhooks events replay

Queues one more delivery of the event. Does not schedule automatic retries.

**Arguments:** `[webhookId]` `[eventId]`

The webhook must be enabled — re-enable it first with
`resend webhooks update <webhook-id> --status enabled`.

Returns `{"object":"webhook_event","id":"<event-id>"}` — no `type`, `status`,
or `payload` (use `events get` for those).

---

## webhooks listen

Start a local server that receives Resend webhook events in real time via a public tunnel URL.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--url <url>` | string | — | Public tunnel URL for receiving webhooks (required in non-interactive) |
| `--forward-to <url>` | string | — | Forward payloads to this local URL (preserves Svix headers) |
| `--events <events...>` | string[] | all | Event types to listen for |
| `--port <port>` | number | 4318 | Local server port |

**Behavior:**
1. Starts a local HTTP server on `--port`
2. Registers a temporary Resend webhook pointing at `--url`
3. Displays incoming events in the terminal
4. Optionally forwards payloads to `--forward-to` with original Svix headers
5. Deletes the temporary webhook on exit (Ctrl+C)
