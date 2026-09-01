import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { webhookPickerConfig } from '../utils';
import { webhookEventPickerConfig } from './utils';

export const getWebhookEventCommand = new Command('get')
  .description('Retrieve a single event delivered to a webhook')
  .argument('[webhookId]', 'Webhook ID')
  .argument('[eventId]', 'Webhook event ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `next_attempt_at is when the next delivery attempt is scheduled. It is null
once the event reaches success or failed.

payload is the JSON body that was sent to your endpoint.`,
      output: `  {"object":"webhook_event","id":"msg_...","type":"email.sent","created_at":"...","status":"attempting","next_attempt_at":"...","payload":{...}}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend webhooks events get 4dd369bc-aa82-4ff3-97de-514ae3000ee0 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2',
        'resend webhooks events get 4dd369bc-aa82-4ff3-97de-514ae3000ee0 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2 --json',
      ],
    }),
  )
  .action(async (webhookIdArg, eventIdArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const webhookId = await pickId(
      webhookIdArg,
      webhookPickerConfig,
      globalOpts,
    );
    const eventId = await pickId(
      eventIdArg,
      webhookEventPickerConfig(webhookId),
      globalOpts,
    );

    await runGet(
      {
        loading: 'Fetching webhook event...',
        sdkCall: (resend) => resend.webhooks.events.get({ webhookId, eventId }),
        onInteractive: (event) => {
          console.log(`${event.type} - ${event.status}`);
          console.log(`ID:           ${event.id}`);
          console.log(`Created:      ${event.created_at}`);
          console.log(`Next attempt: ${event.next_attempt_at ?? '(none)'}`);
          console.log(`\nPayload:\n${JSON.stringify(event.payload, null, 2)}`);
        },
      },
      globalOpts,
    );
  });
