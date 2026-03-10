import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createBroadcastCommand } from './create';
import { deleteBroadcastCommand } from './delete';
import { getBroadcastCommand } from './get';
import { listBroadcastsCommand } from './list';
import { sendBroadcastCommand } from './send';
import { updateBroadcastCommand } from './update';

export const broadcastsCommand = new Command('broadcasts')
  .description('Manage broadcasts — bulk email to a segment of contacts')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Lifecycle:
  Broadcasts follow a draft → send flow:
    1. create  — creates a draft (or sends immediately with --send)
    2. send    — sends an API-created draft (dashboard broadcasts cannot be sent via API)
  Scheduled broadcasts can be deleted to cancel delivery; sent broadcasts are immutable.

Template variables:
  HTML bodies support triple-brace interpolation for contact properties.
  Example: {{{FIRST_NAME|Friend}}} — uses FIRST_NAME or falls back to "Friend".

Scheduling:
  --scheduled-at accepts ISO 8601 or natural language e.g. "in 1 hour", "tomorrow at 9am ET".`,
      examples: [
        'resend broadcasts list',
        'resend broadcasts create --from hello@domain.com --subject "Launch" --segment-id seg_123 --html "<p>Hi {{{FIRST_NAME|there}}}</p>"',
        'resend broadcasts send bcast_123abc',
        'resend broadcasts send bcast_123abc --scheduled-at "in 1 hour"',
        'resend broadcasts get bcast_123abc',
        'resend broadcasts update bcast_123abc --subject "Updated Subject"',
        'resend broadcasts delete bcast_123abc --yes',
      ],
    }),
  )
  .addCommand(createBroadcastCommand)
  .addCommand(sendBroadcastCommand)
  .addCommand(getBroadcastCommand)
  .addCommand(listBroadcastsCommand, { isDefault: true })
  .addCommand(updateBroadcastCommand)
  .addCommand(deleteBroadcastCommand);
