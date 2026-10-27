# Webhooks trigger: PR demo

This walkthrough demonstrates the compiled CLI sending signed, synthetic Resend-shaped events to a local HTTP receiver. The receiver verifies each signature with the Resend SDK. No Resend API key or Resend API call is used.

## 1. Build the CLI

From the repository root:

```sh
pnpm build
```

## 2. Start a local receiver

In terminal A, use a development-only secret. Set the same value in terminal B and in the app under test.
This fixed example secret is public and must never be used outside local testing.

```sh
export RESEND_WEBHOOK_SECRET='whsec_bG9jYWwtZGV2ZWxvcG1lbnQtc2VjcmV0'
node --input-type=module <<'NODE'
import { createServer } from 'node:http';
import { Resend } from 'resend';

const secret = process.env.RESEND_WEBHOOK_SECRET;
if (!secret) throw new Error('Set RESEND_WEBHOOK_SECRET first');
const resend = new Resend('unused'); // Only webhooks.verify() is used; no API request is made.

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const payload = Buffer.concat(chunks).toString('utf8');

  try {
    const event = resend.webhooks.verify({
      payload,
      headers: {
        id: String(req.headers['svix-id']),
        timestamp: String(req.headers['svix-timestamp']),
        signature: String(req.headers['svix-signature']),
      },
      webhookSecret: secret,
    });
    console.log(JSON.stringify({ signature: 'valid', event }, null, 2));
    res.writeHead(200, { 'content-type': 'text/plain' }).end('accepted');
  } catch {
    res.writeHead(400).end('invalid signature');
  }
}).listen(8787, '127.0.0.1', () => {
  console.log('Signature-checking receiver listening at http://127.0.0.1:8787');
});
NODE
```

## 3. Send an overridden delivered event

In terminal B:

```sh
export RESEND_WEBHOOK_SECRET='whsec_bG9jYWwtZGV2ZWxvcG1lbnQtc2VjcmV0'
node dist/cli.cjs --json webhooks trigger email.delivered \
  --forward-to http://127.0.0.1:8787/webhooks/resend \
  --email-id email_pr_demo_42 \
  --message-id '<pr-demo@example.test>' \
  --from 'QA Sender <qa@example.test>' \
  --to dev@example.test \
  --subject 'Webhook PR demo' \
  --tag scenario=pr-demo \
  --delivery-id msg_local_pr_demo_delivered_1
```

The receiver prints the verified event. Its key fields are:

```json
{
  "signature": "valid",
  "event": {
    "type": "email.delivered",
    "data": {
      "email_id": "email_pr_demo_42",
      "message_id": "<pr-demo@example.test>",
      "from": "QA Sender <qa@example.test>",
      "to": ["dev@example.test"],
      "subject": "Webhook PR demo",
      "tags": { "scenario": "pr-demo" }
    }
  }
}
```

The CLI returns a successful HTTP result (duration varies by machine):

```json
{
  "synthetic": true,
  "event_type": "email.delivered",
  "delivery_id": "msg_local_pr_demo_delivered_1",
  "http_status": 200,
  "duration_ms": 52,
  "response_body": "accepted",
  "response_truncated": false
}
```

## 4. Send a bounced event with bounce overrides

```sh
node dist/cli.cjs --json webhooks trigger email.bounced \
  --forward-to http://127.0.0.1:8787/webhooks/resend \
  --bounce-type Transient \
  --bounce-sub-type MailboxFull \
  --bounce-message 'Synthetic mailbox full for PR demo' \
  --delivery-id msg_local_pr_demo_bounced_1
```

The verified event has `type: "email.bounced"` and the following data:

```json
{
  "type": "Transient",
  "subType": "MailboxFull",
  "message": "Synthetic mailbox full for PR demo"
}
```

## 5. Preview without sending

```sh
node dist/cli.cjs --json webhooks trigger email.complained \
  --forward-to http://127.0.0.1:8787/webhooks/resend \
  --dry-run
```

The output includes the generated JSON body and signed headers. The receiver does not log another request; the dry-run signature can be verified with the receiver's SDK verification code if desired.

## Verified locally

The compiled `dist/cli.cjs` was run as a separate process against an ephemeral receiver bound to `127.0.0.1`. The receiver verified the delivered and bounced signatures with `resend.webhooks.verify()`. The test confirmed the explicit field overrides, successful HTTP 200 responses, and that `--dry-run` produced a valid signature without sending a request. `RESEND_API_KEY` was unset throughout.

The automated command tests are in [tests/commands/webhooks/trigger.test.ts](../tests/commands/webhooks/trigger.test.ts).
