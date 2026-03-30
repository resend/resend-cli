# logs

Detailed flag specifications for `resend logs` commands.

---

## logs list

List API request logs with pagination. The list response returns a subset of fields — use `logs get <id>` for full request/response bodies.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit <n>` | number | 10 | Max results (1-100) |
| `--after <cursor>` | string | — | Forward pagination |
| `--before <cursor>` | string | — | Backward pagination |

**Output:** `{"object":"list","data":[{"id":"...","created_at":"...","endpoint":"...","method":"...","response_status":200,"user_agent":"..."|null}],"has_more":false}`

---

## logs get

Retrieve a single API request log with full request and response bodies.

**Argument:** `[id]` — Log ID (UUID). Omit in interactive mode to pick from a list.

**Output:** `{"object":"log","id":"...","created_at":"...","endpoint":"...","method":"...","response_status":200,"user_agent":"..."|null,"request_body":{...},"response_body":{...}}`

---

## logs open

Open a log or the logs list in the Resend dashboard in your default browser.

**Argument:** `[id]` — Log ID. Omit to open the logs list.
