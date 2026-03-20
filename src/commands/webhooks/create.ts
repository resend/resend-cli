import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { WebhookEvent } from 'resend';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { cancelAndExit, requireText } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';
import { ALL_WEBHOOK_EVENTS, normalizeEvents } from './utils';

export const createWebhookCommand = new Command('create')
  .description(
    'Register a new webhook endpoint to receive real-time event notifications',
  )
  .option(
    '--endpoint <endpoint>',
    'HTTPS URL to receive webhook events (required)',
  )
  .option(
    '--events <events...>',
    'Event types to subscribe to (comma or space-separated). Use "all" for all 17 events.',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Webhooks deliver real-time event notifications to your HTTPS endpoint.
Events fire per-recipient: a batch email to 3 recipients generates 3 email.sent events.

--endpoint must use HTTPS.

--events accepts comma or space-separated event types, or the special value "all":
  resend webhooks create --endpoint https://... --events email.sent email.delivered
  resend webhooks create --endpoint https://... --events email.sent,email.delivered
  resend webhooks create --endpoint https://... --events all

Available event types (17 total):
  Email:   email.sent, email.delivered, email.delivery_delayed, email.bounced,
           email.complained, email.opened, email.clicked, email.failed,
           email.scheduled, email.suppressed, email.received
  Contact: contact.created, contact.updated, contact.deleted
  Domain:  domain.created, domain.updated, domain.deleted

The signing_secret in the response is shown ONCE — save it immediately to verify
webhook payloads using Svix signature headers (svix-id, svix-timestamp, svix-signature).
Use resend.webhooks.verify() in your application to validate incoming payloads.

Non-interactive: --endpoint and --events are required.`,
      output: `  {"object":"webhook","id":"<uuid>","signing_secret":"<whsec_...>"}`,
      errorCodes: [
        'auth_error',
        'missing_endpoint',
        'missing_events',
        'create_error',
      ],
      examples: [
        'resend webhooks create --endpoint https://app.example.com/hooks/resend --events all',
        'resend webhooks create --endpoint https://app.example.com/hooks/resend --events email.sent email.bounced',
        'resend webhooks create --endpoint https://app.example.com/hooks/resend --events all --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const endpoint = await requireText(
      opts.endpoint,
      {
        message: 'Webhook endpoint URL',
        placeholder: 'https://your-app.com/webhooks/resend',
        validate: (v) => {
          if (!v) {
            return 'Endpoint URL is required';
          }
          if (!v.startsWith('https://')) {
            return 'Endpoint must use HTTPS';
          }
          return undefined;
        },
      },
      { message: 'Missing --endpoint flag.', code: 'missing_endpoint' },
      globalOpts,
    );

    let selectedEvents: WebhookEvent[];

    const normalized = opts.events?.length
      ? normalizeEvents(opts.events)
      : undefined;

    if (normalized?.includes('all')) {
      selectedEvents = ALL_WEBHOOK_EVENTS;
    } else if (normalized?.length) {
      selectedEvents = normalized as WebhookEvent[];
    } else {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --events flag.', code: 'missing_events' },
          { json: globalOpts.json },
        );
      }
      const result = await p.multiselect({
        message: 'Select event types to subscribe to',
        options: ALL_WEBHOOK_EVENTS.map((e) => ({ value: e, label: e })),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      selectedEvents = result;
    }

    await runCreate(
      {
        spinner: {
          loading: 'Creating webhook...',
          success: 'Webhook created',
          fail: 'Failed to create webhook',
        },
        sdkCall: (resend) =>
          resend.webhooks.create({
            endpoint,
            events: selectedEvents,
          }),
        onInteractive: (d) => {
          console.log(`\nWebhook created`);
          console.log(`ID:             ${d.id}`);
          console.log(`Signing Secret: ${d.signing_secret}`);
          console.log(`\nSave the signing secret — it is only shown once.`);
        },
      },
      globalOpts,
    );
  });
