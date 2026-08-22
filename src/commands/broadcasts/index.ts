import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { cancelBroadcastCommand } from './cancel';
import { clickedLinksBroadcastCommand } from './clicked-links';
import { createBroadcastCommand } from './create';
import { deleteBroadcastCommand } from './delete';
import { getBroadcastCommand } from './get';
import { listBroadcastsCommand } from './list';
import { openBroadcastCommand } from './open';
import { sendBroadcastCommand } from './send';
import { updateBroadcastCommand } from './update';

export const broadcastsCommand = new Command('broadcasts')
  .description('Manage broadcasts')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Lifecycle:
  Broadcasts follow a draft → send flow:
    1. create  — creates a draft (or sends immediately with --send)
    2. send    — sends an API-created draft (dashboard broadcasts cannot be sent via API)
  cancel stops a queued broadcast mid-send, or reverts a scheduled broadcast to
    draft, without removing it.
  delete removes a broadcast entirely (and cancels delivery first, if scheduled).
  Sent broadcasts are immutable — neither cancel nor delete can be used on them.

Template variables:
  HTML bodies support triple-brace interpolation for contact properties.
  Example: {{{FIRST_NAME|Friend}}} — uses FIRST_NAME or falls back to "Friend".

Scheduling:
  --scheduled-at accepts ISO 8601 or natural language e.g. "in 1 hour", "tomorrow at 9am ET".`,
      examples: [
        'resend broadcasts list',
        'resend broadcasts create --from onboarding@resend.dev --subject "Launch" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --html "<p>Hi {{{FIRST_NAME|there}}}</p>"',
        'resend broadcasts send d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts send d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --scheduled-at "in 1 hour"',
        'resend broadcasts get d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts update d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --subject "Updated Subject"',
        'resend broadcasts cancel d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts delete d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --yes',
        'resend broadcasts open',
        'resend broadcasts open d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts clicked-links d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
      ],
    }),
  )
  .addCommand(createBroadcastCommand)
  .addCommand(openBroadcastCommand)
  .addCommand(sendBroadcastCommand)
  .addCommand(getBroadcastCommand)
  .addCommand(listBroadcastsCommand, { isDefault: true })
  .addCommand(updateBroadcastCommand)
  .addCommand(cancelBroadcastCommand)
  .addCommand(deleteBroadcastCommand)
  .addCommand(clickedLinksBroadcastCommand);
