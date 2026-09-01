import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { listWebhookEventAttemptsCommand } from './attempts';
import { getWebhookEventCommand } from './get';
import { listWebhookEventsCommand } from './list';

export const webhookEventsCommand = new Command('events')
  .description('Inspect the events Resend delivered to a webhook')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Debugging a webhook that is missing deliveries:
  1. resend webhooks events list <webhook-id>                  (find the event)
  2. resend webhooks events get <webhook-id> <event-id>        (see the payload we sent)
  3. resend webhooks events attempts <webhook-id> <event-id>   (see what your endpoint returned)

Events are retained per webhook and listed most recent first. Both list commands
paginate forward only, with --after.`,
      examples: [
        'resend webhooks events list 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend webhooks events get 4dd369bc-aa82-4ff3-97de-514ae3000ee0 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2',
        'resend webhooks events attempts 4dd369bc-aa82-4ff3-97de-514ae3000ee0 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2',
      ],
    }),
  )
  .addCommand(listWebhookEventsCommand, { isDefault: true })
  .addCommand(getWebhookEventCommand)
  .addCommand(listWebhookEventAttemptsCommand);
