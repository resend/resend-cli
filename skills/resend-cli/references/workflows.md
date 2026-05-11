# Workflow Recipes

Multi-step recipes for common Resend CLI tasks.

---

## 1. Initial Setup

```bash
# Install (pick one)
curl -fsSL https://resend.com/install.sh | bash   # Linux / macOS
npm install -g resend-cli                          # npm
brew install resend/cli/resend                     # Homebrew (macOS / Linux)
irm https://resend.com/install.ps1 | iex           # Windows PowerShell

# Authenticate
resend login --key re_xxx

# Verify setup
resend doctor -q
```

---

## 2. Send a Single Email

```bash
# Basic text email
resend emails send \
  --from "you@example.com" \
  --to recipient@example.com \
  --subject "Hello" \
  --text "Body text"

# HTML email with attachments
resend emails send \
  --from "Name <you@example.com>" \
  --to alice@example.com bob@example.com \
  --subject "Report" \
  --html-file ./email.html \
  --attachment ./report.pdf \
  --cc manager@example.com \
  --reply-to support@example.com

# React Email template (.tsx) — bundles, renders to HTML, and sends
resend emails send \
  --from "you@example.com" \
  --to recipient@example.com \
  --subject "Welcome" \
  --react-email ./emails/welcome.tsx

# React Email with plain-text fallback
resend emails send \
  --from "you@example.com" \
  --to recipient@example.com \
  --subject "Welcome" \
  --react-email ./emails/welcome.tsx \
  --text "Welcome to our platform!"

# Scheduled email (ISO 8601 or natural language)
resend emails send \
  --from "you@example.com" \
  --to recipient@example.com \
  --subject "Reminder" \
  --text "Don't forget!" \
  --scheduled-at "tomorrow at 9am ET"

# Check status
resend emails get <email-id>

# Cancel if scheduled
resend emails cancel <email-id>
```

---

## 3. Batch Sending

```bash
# Create a JSON file with up to 100 emails
cat > batch.json << 'EOF'
[
  {"from":"you@domain.com","to":["a@example.com"],"subject":"Hi A","text":"Hello A"},
  {"from":"you@domain.com","to":["b@example.com"],"subject":"Hi B","text":"Hello B"}
]
EOF

# Send batch (strict mode: all fail if any invalid)
resend emails batch --file batch.json --batch-validation strict

# Send batch (permissive: partial success allowed)
resend emails batch --file batch.json --batch-validation permissive
```

---

## 4. Domain Setup

```bash
# Create domain with receiving enabled
resend domains create --name example.com --region us-east-1 --receiving

# Output includes DNS records to configure:
# - MX records, TXT/DKIM records, SPF, DMARC
# Configure these in your DNS provider, then:

# Trigger verification
resend domains verify <domain-id>

# Check status (repeat until "verified")
resend domains get <domain-id>

# Enable tracking
resend domains update <domain-id> --open-tracking --click-tracking
```

---

## 5. Broadcasts (Bulk Email)

```bash
# 1. Create a segment
resend segments create --name "Newsletter Subscribers"

# 2. Add contacts to segment
resend contacts create --email user@example.com --first-name Jane --segment-id <segment-id>

# 3. Create and send broadcast
resend broadcasts create \
  --from "news@example.com" \
  --subject "Monthly Update" \
  --segment-id <segment-id> \
  --html "<h1>Hello {{{FIRST_NAME|there}}}</h1><p>News content...</p>" \
  --send

# Create broadcast from a React Email template
resend broadcasts create \
  --from "news@example.com" \
  --subject "Monthly Update" \
  --segment-id <segment-id> \
  --react-email ./emails/newsletter.tsx \
  --text "Plain-text fallback for email clients that don't support HTML"

# Or create as draft first, then send later
resend broadcasts create \
  --from "news@example.com" \
  --subject "Monthly Update" \
  --segment-id <segment-id> \
  --html-file ./newsletter.html \
  --name "March Newsletter"

resend broadcasts send <broadcast-id>

# Schedule for later (ISO 8601 or natural language)
resend broadcasts send <broadcast-id> --scheduled-at "in 2 hours"
```

---

## 6. Webhook Setup

```bash
# Create webhook for email delivery events
resend webhooks create \
  --endpoint https://yourapp.com/webhooks/resend \
  --events email.delivered email.bounced email.complained

# IMPORTANT: Save the signing_secret from output — shown once only

# Or subscribe to all events
resend webhooks create \
  --endpoint https://yourapp.com/webhooks/resend \
  --events all

# Disable temporarily
resend webhooks update <webhook-id> --status disabled

# Re-enable
resend webhooks update <webhook-id> --status enabled

# Change subscribed events (replaces entire list)
resend webhooks update <webhook-id> --events email.delivered email.bounced

# Local development listener (requires a tunnel like ngrok)
resend webhooks listen --url https://example.ngrok-free.app

# Forward events to your local app
resend webhooks listen \
  --url https://example.ngrok-free.app \
  --forward-to localhost:3000/webhook

# Listen for specific events only
resend webhooks listen \
  --url https://example.ngrok-free.app \
  --events email.delivered email.bounced
```

---

## 7. Profile Management

```bash
# Add production profile
resend login --key re_prod_xxx
# When prompted, name it "production"

# Add staging profile
resend auth switch  # or create via login
resend login --key re_staging_xxx

# List profiles
resend auth list

# Switch active profile
resend auth switch production

# Use a profile for a single command
resend emails list --profile staging

# Rename profile
resend auth rename old-name new-name

# Remove profile
resend auth remove staging
```

---

## 8. Templates

```bash
# Create a template with variables
resend templates create \
  --name "Welcome Email" \
  --subject "Welcome, {{{NAME}}}!" \
  --html "<h1>Welcome {{{NAME}}}</h1><p>Your plan: {{{PLAN}}}</p>" \
  --from "welcome@example.com" \
  --alias welcome-email \
  --var NAME:string --var PLAN:string:free

# Publish the template
resend templates publish welcome-email

# Send an email using a template
resend emails send \
  --to user@example.com \
  --template <template-id> \
  --var NAME=Jane --var PLAN=pro

# Duplicate for A/B testing
resend templates duplicate welcome-email

# Update the copy
resend templates update <new-id> --name "Welcome Email v2" --subject "Hey {{{NAME}}}!"

# Create a template from a React Email component
resend templates create \
  --name "Onboarding" \
  --react-email ./emails/onboarding.tsx

# Update a template with a new React Email version
resend templates update <id> --react-email ./emails/onboarding-v2.tsx
```

---

## 9. Contact & Topic Management

```bash
# Define custom properties
resend contact-properties create --key company --type string
resend contact-properties create --key plan --type string --fallback-value free

# Create contacts with properties
resend contacts create \
  --email user@example.com \
  --first-name Jane \
  --last-name Smith \
  --properties '{"company":"Acme","plan":"pro"}'

# Create topics for subscription preferences
resend topics create --name "Product Updates" --default-subscription opt_in
resend topics create --name "Marketing" --default-subscription opt_out

# Update contact topic subscriptions
resend contacts update-topics user@example.com \
  --topics '[{"id":"<topic-id>","subscription":"opt_in"}]'

# Check subscriptions
resend contacts topics user@example.com
```

---

## 10. Automations & Events

```bash
# 1. Create an event definition (the trigger signal)
resend events create --name "user.signed_up" --schema '{"plan":"string"}'

# 2. Create an automation triggered by that event
#    Using a JSON file:
cat > workflow.json << 'EOF'
{
  "name": "Welcome Flow",
  "steps": [
    { "key": "t", "type": "trigger", "config": { "eventName": "user.signed_up" } },
    { "key": "d", "type": "delay", "config": { "duration": "5m" } },
    { "key": "e", "type": "send_email", "config": { "template": { "id": "<published-template-id>" } } }
  ],
  "connections": [
    { "from": "t", "to": "d", "type": "default" },
    { "from": "d", "to": "e", "type": "default" }
  ]
}
EOF

resend automations create --file workflow.json

# 3. Enable the automation
resend automations update <automation-id> --status enabled

# 4. Send an event to trigger it
resend events send --event "user.signed_up" --email user@example.com --payload '{"plan":"pro"}'

# 5. Check runs
resend automations runs <automation-id>
resend automations runs get --automation-id <id> --run-id <id>

# 6. View in dashboard
resend automations open <automation-id>

# Disable when done
resend automations update <automation-id> --status disabled

# Clean up
resend automations delete <automation-id> --yes
resend events delete <event-id> --yes
```

---

## 11. CI/CD Integration

```yaml
# GitHub Actions example
name: Deploy Notification
on:
  push:
    branches: [main]

env:
  RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Install Resend CLI
        run: npm install -g resend-cli

      - name: Send deploy notification
        run: |
          resend emails send \
            --from "deploy@example.com" \
            --to "team@example.com" \
            --subject "Deploy: ${{ github.repository }}@${{ github.sha }}" \
            --text "Deployed by ${{ github.actor }} at $(date -u)"
```

```bash
# Generic CI script
export RESEND_API_KEY=re_xxx
resend emails send -q \
  --from "ci@example.com" \
  --to "team@example.com" \
  --subject "Build complete" \
  --text "Build ${BUILD_ID} passed all tests."
```

---

## 12. Inbound Email Processing

```bash
# Enable receiving on domain (at creation or check existing)
resend domains create --name example.com --receiving

# List received emails
resend emails receiving list --limit 20

# Get full email content
resend emails receiving get <email-id>

# List attachments
resend emails receiving attachments <email-id>

# Get specific attachment download URL
resend emails receiving attachment <email-id> <attachment-id>

# Forward received email
resend emails receiving forward <email-id> \
  --from "forwarded@example.com" \
  --to colleague@example.com

# Watch for new inbound emails in real time
resend emails receiving listen

# Poll every 10 seconds
resend emails receiving listen --interval 10

# Stream as NDJSON (for scripting)
resend emails receiving listen --json | head -3
```
