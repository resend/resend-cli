# Resend CLI — Full Command Reference

## Global Options

These flags work on any command:

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override the API key for this command (bypasses env-var and profile) |
| `--profile <name>` / `-p <name>` | Use a specific CLI profile |
| `--json` | Output structured JSON (always recommended for parsing) |
| `--quiet` / `-q` | Suppress non-essential output (useful in CI/scripts) |
| `--version` | Print CLI version and exit |
| `--help` | Show help for any command |

---

## Authentication & Identity

Manage CLI profiles and auth state. Profiles store API keys locally so you don't need env-vars.

### auth login — Authenticate and create/update a CLI profile
```bash
resend auth login [--name <profile-name>]
```
Launches an interactive flow to save an API key under a named profile. If `--name` is omitted, uses "default".

### auth logout — Remove the current profile's stored credentials
```bash
resend auth logout
```

### auth list — List all saved CLI profiles
```bash
resend auth list
```

### auth switch — Switch the active CLI profile
```bash
resend auth switch --name <profile-name>
```

### auth remove — Delete a saved CLI profile
```bash
resend auth remove --name <profile-name>
```

### login — Top-level shortcut for auth login
```bash
resend login [--name <profile-name>]
```

### logout — Top-level shortcut for auth logout
```bash
resend logout
```

### whoami — Show current auth status
```bash
resend whoami
```
Displays the active profile name, masked API key, and key source (profile vs env-var).

### open — Open Resend dashboard in browser
```bash
resend open
```
Opens `resend.com/emails` in the default browser.

---

## Diagnostics

### doctor — Run health checks on CLI and account
```bash
resend doctor [--json]
```
Checks: CLI version, API key validity, domain verification status, DNS records, sending/receiving readiness. Use this as the first step when troubleshooting.

---

## Emails — Send and manage transactional emails

### emails list — List recent emails
```bash
resend emails list [--limit <n>] [--after <cursor>] [--before <cursor>]
```
Default: 10 results, max: 100. Use cursors from `has_more` for pagination.

### emails send — Send a single email
```bash
resend emails send --from <address> --to <address> --subject "Subject" --text "Body"
```
Required: `--from`, `--to`, `--subject`, and one of `--text` / `--html` / `--html-file`.
Optional: `--cc`, `--bcc`, `--reply-to`, `--scheduled-at`, `--attachment <path>`, `--headers key=value`, `--tags name=value`.

### emails get — Get full details for a specific email
```bash
resend emails get <email-id>
```

### emails batch — Batch send up to 100 emails from a JSON file
```bash
resend emails batch --file ./emails.json
```

### emails cancel — Cancel a scheduled email
```bash
resend emails cancel <email-id>
```

### emails update — Update a scheduled email's send time
```bash
resend emails update <email-id> --scheduled-at <ISO-8601-datetime>
```

### emails receiving list — List received inbound emails
```bash
resend emails receiving list
```
Requires domain receiving to be enabled.

### emails receiving get — Get a specific received email
```bash
resend emails receiving get <email-id>
```

### emails receiving attachments — List attachments on a received email
```bash
resend emails receiving attachments <email-id>
```

### emails receiving attachment — Get a single attachment by ID
```bash
resend emails receiving attachment <email-id> <attachment-id>
```

### emails receiving forward — Forward a received email
```bash
resend emails receiving forward <email-id> --to <address> --from <address>
```

---

## Domains — Manage sending/receiving domains

### domains list — List all domains
```bash
resend domains list
```

### domains get — Get domain details including DNS records
```bash
resend domains get <id>
```

### domains create — Add a new domain
```bash
resend domains create --name example.com [--region us-east-1]
```

### domains verify — Trigger DNS verification
```bash
resend domains verify <id>
```

### domains update — Update domain settings
```bash
resend domains update <id> [--tls enforced] [--open-tracking] [--click-tracking]
```

### domains delete — Remove a domain
```bash
resend domains delete <id> --yes
```

Domain lifecycle: create -> configure DNS -> verify -> poll with `get` until "verified".

---

## API Keys — Manage authentication keys

### api-keys list — List all API keys (names and IDs only)
```bash
resend api-keys list
```
Tokens are never returned — they are shown only at creation time.

### api-keys create — Create a new API key
```bash
resend api-keys create --name "Name" [--permission sending_access --domain-id <id>]
```

### api-keys delete — Delete an API key immediately
```bash
resend api-keys delete <id> --yes
```
Warning: Services using this key lose access instantly.

---

## Broadcasts — Bulk email to contact segments

### broadcasts list — List all broadcasts
```bash
resend broadcasts list [--limit <n>]
```

### broadcasts get — Get broadcast details including HTML body
```bash
resend broadcasts get <id>
```

### broadcasts create — Create a new broadcast
```bash
resend broadcasts create --from <address> --subject "Subject" --segment-id <id> --html "<p>Hi</p>" [--send]
```
Pass `--send` to send immediately on creation.

### broadcasts send — Send or schedule a draft broadcast
```bash
resend broadcasts send <id> [--scheduled-at "in 1 hour"]
```
Scheduling accepts ISO 8601 or natural language like "in 1 hour", "tomorrow at 9am ET".

### broadcasts update — Update a draft broadcast
```bash
resend broadcasts update <id> --subject "Updated"
```
Only works on drafts — sent broadcasts cannot be updated.

### broadcasts delete — Delete a broadcast
```bash
resend broadcasts delete <id> --yes
```

Notes:
- Template variables use triple-brace syntax: `{{{FIRST_NAME|Friend}}}` (pipe provides fallback).
- Only API-created broadcasts can be sent via CLI — dashboard-created ones cannot.

---

## Contacts — Manage the people you email

### contacts list — List all contacts
```bash
resend contacts list [--limit <n>] [--after <cursor>]
```

### contacts get — Get a specific contact
```bash
resend contacts get <id-or-email>
```

### contacts create — Create a new contact
```bash
resend contacts create --email user@example.com [--first-name Jane] [--last-name Doe]
```

### contacts update — Update a contact
```bash
resend contacts update <id-or-email> [--unsubscribed] [--properties '{"plan":"pro"}']
```

### contacts delete — Delete a contact
```bash
resend contacts delete <id-or-email> --yes
```

### contacts segments — List segments for a contact
```bash
resend contacts segments <id-or-email>
```

### contacts add-segment — Add a contact to a segment
```bash
resend contacts add-segment <contactId> --segment-id <segmentId>
```

### contacts remove-segment — Remove a contact from a segment
```bash
resend contacts remove-segment <contactId> <segmentId>
```

### contacts topics — List topic subscriptions for a contact
```bash
resend contacts topics <id-or-email>
```

### contacts update-topics — Update topic subscriptions
```bash
resend contacts update-topics <id-or-email> --topics '[{"id":"topic-uuid","subscription":"opt_in"}]'
```

Contacts are global (not audience-scoped). Custom properties are available in broadcast templates via `{{{PROPERTY_NAME|fallback}}}`.

---

## Contact Properties — Schema for custom contact data

### contact-properties list — List all contact properties
```bash
resend contact-properties list
```

### contact-properties get — Get a specific property
```bash
resend contact-properties get <id>
```

### contact-properties create — Create a new property
```bash
resend contact-properties create --key company_name --type string [--fallback-value "Unknown"]
```
Supported types: `string`, `number`. Keys and types are immutable after creation.

### contact-properties update — Update a property's fallback value
```bash
resend contact-properties update <id> --fallback-value "New Default"
```

### contact-properties delete — Delete a property
```bash
resend contact-properties delete <id> --yes
```

Reserved keys: FIRST_NAME, LAST_NAME, EMAIL, UNSUBSCRIBE_URL.

---

## Segments — Named groups of contacts for targeting broadcasts

### segments list — List all segments
```bash
resend segments list
```

### segments get — Get segment details
```bash
resend segments get <id>
```

### segments create — Create a new segment
```bash
resend segments create --name "Newsletter Subscribers"
```

### segments delete — Delete a segment
```bash
resend segments delete <id> --yes
```

No update endpoint — to rename, delete and recreate. Membership managed via `resend contacts add-segment` / `remove-segment`.

---

## Templates — Reusable email templates

### templates list — List all templates
```bash
resend templates list [--limit <n>]
```

### templates get — Get template details
```bash
resend templates get <id-or-alias>
```

### templates create — Create a new template
```bash
resend templates create --name "Welcome" --html "<h1>Hello {{{NAME}}}</h1>" --subject "Welcome!" --var NAME:string
```

### templates update — Update a template
```bash
resend templates update <id> --subject "Updated" [--html "..."] [--var KEY:type:fallback]
```

### templates publish — Promote a draft template to published
```bash
resend templates publish <id>
```

### templates duplicate — Copy a template as a new draft
```bash
resend templates duplicate <id>
```

### templates delete — Delete a template
```bash
resend templates delete <id> --yes
```

Templates follow a draft -> published workflow. Variable syntax: `--var KEY:type` or `--var KEY:type:fallback`. Valid types: `string`, `number`.

---

## Topics — Subscription preference management

### topics list — List all topics
```bash
resend topics list
```

### topics get — Get topic details
```bash
resend topics get <id>
```

### topics create — Create a new topic
```bash
resend topics create --name "Product Updates" [--default-subscription opt_out]
```

### topics update — Update a topic
```bash
resend topics update <id> --name "New Name"
```

### topics delete — Delete a topic
```bash
resend topics delete <id> --yes
```

Topics enable fine-grained opt-in/opt-out beyond the global unsubscribe flag. Broadcasts can target a `topic_id`.

---

## Webhooks — Real-time event notifications

### webhooks list — List all webhooks
```bash
resend webhooks list
```

### webhooks get — Get webhook details
```bash
resend webhooks get <id>
```

### webhooks create — Create a new webhook
```bash
resend webhooks create --endpoint https://example.com/hooks/resend --events all
```

### webhooks update — Update a webhook
```bash
resend webhooks update <id> [--status disabled] [--events email.delivered,email.bounced]
```

### webhooks delete — Delete a webhook
```bash
resend webhooks delete <id> --yes
```

### webhooks listen — Start a local development listener
```bash
resend webhooks listen [--port 3000]
```

17 event types available:
- **Email**: email.sent, email.delivered, email.delivery_delayed, email.bounced, email.complained, email.opened, email.clicked, email.failed, email.scheduled, email.suppressed, email.received
- **Contact**: contact.created, contact.updated, contact.deleted
- **Domain**: domain.created, domain.updated, domain.deleted

Payloads are signed with Svix headers (svix-id, svix-timestamp, svix-signature).
