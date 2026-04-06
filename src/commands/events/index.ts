import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createEventCommand } from './create';
import { deleteEventCommand } from './delete';
import { getEventCommand } from './get';
import { listEventsCommand } from './list';
import { sendEventCommand } from './send';
import { updateEventCommand } from './update';

export const eventsCommand = new Command('events')
  .description('Manage events')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Events define the signals that trigger automations.
Each event has a name and an optional typed schema (string | number | boolean | date fields).

Lifecycle:
  1. resend events create --name "user.signed_up" --schema '{"plan":"string"}'
  2. resend events send --event "user.signed_up" --contact-id <id>
  3. resend events list
  4. resend events get <id>
  5. resend events update <id> --schema '{"plan":"string","trial":"boolean"}'
  6. resend events delete <id> --yes`,
      examples: [
        'resend events list',
        'resend events create --name "user.signed_up"',
        'resend events create --name "order.completed" --schema \'{"amount":"number","currency":"string"}\'',
        'resend events get <id>',
        'resend events update <id> --schema \'{"plan":"string"}\'',
        'resend events update <id> --schema null',
        'resend events delete <id> --yes',
        'resend events send --event "user.signed_up" --contact-id <id>',
        'resend events send --event "user.signed_up" --email user@example.com --payload \'{"plan":"pro"}\'',
      ],
    }),
  )
  .addCommand(createEventCommand)
  .addCommand(getEventCommand)
  .addCommand(listEventsCommand, { isDefault: true })
  .addCommand(updateEventCommand)
  .addCommand(deleteEventCommand)
  .addCommand(sendEventCommand);
