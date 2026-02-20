import { Command } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { WebhookEvent } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { ALL_WEBHOOK_EVENTS } from './utils';

export const createWebhookCommand = new Command('create')
  .description('Register a new webhook endpoint to receive real-time event notifications')
  .option('--endpoint <endpoint>', 'HTTPS URL to receive webhook events (required)')
  .option('--events <events...>', 'Event types to subscribe to. Use "all" as shorthand for all 17 events.')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Webhooks deliver real-time event notifications to your HTTPS endpoint.
Events fire per-recipient: a batch email to 3 recipients generates 3 email.sent events.

--endpoint must use HTTPS.

--events accepts space-separated event types or the special value "all":
  resend webhooks create --endpoint https://... --events email.sent email.delivered
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
      errorCodes: ['auth_error', 'missing_endpoint', 'missing_events', 'create_error'],
      examples: [
        'resend webhooks create --endpoint https://app.example.com/hooks/resend --events all',
        'resend webhooks create --endpoint https://app.example.com/hooks/resend --events email.sent email.bounced',
        'resend webhooks create --endpoint https://app.example.com/hooks/resend --events all --json',
      ],
    })
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    let endpoint = opts.endpoint;

    if (!endpoint) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --endpoint flag.', code: 'missing_endpoint' }, { json: globalOpts.json });
      }
      const result = await p.text({
        message: 'Webhook endpoint URL',
        placeholder: 'https://your-app.com/webhooks/resend',
        validate: (v) => {
          if (!v) return 'Endpoint URL is required';
          if (!v.startsWith('https://')) return 'Endpoint must use HTTPS';
          return undefined;
        },
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      endpoint = result;
    }

    let selectedEvents: WebhookEvent[];

    if (opts.events?.includes('all')) {
      selectedEvents = ALL_WEBHOOK_EVENTS;
    } else if (opts.events?.length) {
      selectedEvents = opts.events as WebhookEvent[];
    } else {
      if (!isInteractive()) {
        outputError({ message: 'Missing --events flag.', code: 'missing_events' }, { json: globalOpts.json });
      }
      const result = await p.multiselect({
        message: 'Select event types to subscribe to',
        options: ALL_WEBHOOK_EVENTS.map((e) => ({ value: e, label: e })),
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      selectedEvents = result;
    }

    const spinner = createSpinner('Creating webhook...');

    try {
      const { data, error } = await resend.webhooks.create({
        endpoint: endpoint!,
        events: selectedEvents,
      });

      if (error) {
        spinner.fail('Failed to create webhook');
        outputError({ message: error.message, code: 'create_error' }, { json: globalOpts.json });
      }

      spinner.stop('Webhook created');

      if (!globalOpts.json && isInteractive()) {
        const d = data!;
        console.log(`\nWebhook created`);
        console.log(`ID:             ${d.id}`);
        console.log(`Signing Secret: ${d.signing_secret}`);
        console.log(`\nSave the signing secret — it is only shown once.`);
      } else {
        outputResult(data!, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to create webhook');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'create_error' }, { json: globalOpts.json });
    }
  });
