# Missing CLI Commands

Commands supported by the SDK (`resend` npm package) that have no CLI equivalent yet.

Source comparison: `resend-node/src/` resource classes vs `resend-cli/src/commands/`.

## Templates (7 commands)

The entire `templates` namespace is missing from the CLI.

| Command | SDK method | Notes |
|---|---|---|
| `resend templates create` | `templates.create(payload)` | `--name`, `--subject`, `--html`, `--text` |
| `resend templates list` | `templates.list(opts)` | Pagination support |
| `resend templates get <id>` | `templates.get(id)` | Also supports alias lookup |
| `resend templates update <id>` | `templates.update(id, payload)` | `--name`, `--subject`, `--html`, `--text` |
| `resend templates delete <id>` | `templates.remove(id)` | Confirmation prompt |
| `resend templates duplicate <id>` | `templates.duplicate(id)` | |
| `resend templates publish <id>` | `templates.publish(id)` | |

## Sent Emails (4 commands)

The `emails` namespace only has `send` and `batch`. These read/manage operations are missing:

| Command | SDK method | Notes |
|---|---|---|
| `resend emails list` | `emails.list(opts)` | Pagination support |
| `resend emails get <id>` | `emails.get(id)` | Retrieve a sent email by ID |
| `resend emails update <id>` | `emails.update(payload)` | Reschedule a scheduled email (`--scheduled-at`) |
| `resend emails cancel <id>` | `emails.cancel(id)` | Cancel a scheduled email |

## Not planned

These SDK methods don't map cleanly to CLI commands:

| SDK method | Reason |
|---|---|
| `emails.receiving.forward(opts)` | Convenience wrapper that calls `emails.send` internally, not a distinct API endpoint |
| `webhooks.verify(payload)` | Signature verification utility using Svix. Used in server-side webhook handlers, not useful as a CLI command |

## Coverage summary

| Namespace | SDK methods | CLI commands | Coverage |
|---|---|---|---|
| emails (send/batch) | 6 | 2 | 33% |
| emails.receiving | 5 | 4 | 80% |
| domains | 6 | 6 | 100% |
| api-keys | 3 | 3 | 100% |
| contacts | 5 | 5 | 100% |
| contacts.segments | 3 | 3 | 100% |
| contacts.topics | 2 | 2 | 100% |
| broadcasts | 6 | 6 | 100% |
| contact-properties | 5 | 5 | 100% |
| segments | 4 | 4 | 100% |
| topics | 5 | 5 | 100% |
| templates | 7 | 0 | 0% |
| webhooks | 5 | 5 | 100% |
| **Total** | **62** | **51** | **82%** |
