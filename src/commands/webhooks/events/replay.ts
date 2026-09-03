import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { webhookPickerConfig } from '../utils';
import { webhookEventPickerConfig } from './utils';

export const replayWebhookEventCommand = new Command('replay')
  .description('Queue another delivery attempt for a webhook event')
  .argument('[webhookId]', 'Webhook ID')
  .argument('[eventId]', 'Webhook event ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Queues one more delivery of the event. Does not schedule automatic retries.
The webhook must be enabled — re-enable it first with: resend webhooks update <webhook-id> --status enabled`,
      output: `  {"object":"webhook_event","id":"msg_..."}`,
      errorCodes: ['auth_error', 'replay_error'],
      examples: [
        'resend webhooks events replay 4dd369bc-aa82-4ff3-97de-514ae3000ee0 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2',
        'resend webhooks events replay 4dd369bc-aa82-4ff3-97de-514ae3000ee0 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2 --json',
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

    await runWrite(
      {
        loading: 'Replaying webhook event...',
        sdkCall: (resend) =>
          resend.webhooks.events.replay({ webhookId, eventId }),
        errorCode: 'replay_error',
        successMsg: `Webhook event replay queued: ${eventId}`,
      },
      globalOpts,
    );
  });
