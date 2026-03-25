import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { addContactSegmentCommand } from './add-segment';
import { createContactCommand } from './create';
import { deleteContactCommand } from './delete';
import { getContactCommand } from './get';
import { listContactsCommand } from './list';
import { removeContactSegmentCommand } from './remove-segment';
import { listContactSegmentsCommand } from './segments';
import { listContactTopicsCommand } from './topics';
import { updateContactCommand } from './update';
import { updateContactTopicsCommand } from './update-topics';

export const contactsCommand = new Command('contacts')
  .description('Manage contacts')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Contacts are global entities (not audience-scoped since the 2025 migration).
Each contact is identified by a UUID or email address — both are accepted in all subcommands.

Properties:
  Contacts carry custom key-value properties (e.g. plan, company) accessible in broadcast templates
  via {{{PROPERTY_NAME|fallback}}} triple-brace interpolation.
  firstName/lastName are convenience aliases stored as FIRST_NAME/LAST_NAME properties.

Subscription:
  --unsubscribed is a team-wide opt-out from all broadcasts.
  Fine-grained control is available via topic subscriptions (see "resend contacts topics").

Segments:
  Contacts can belong to multiple segments. Segments determine which contacts receive a broadcast.
  Manage membership with "resend contacts add-segment" and "resend contacts remove-segment".`,
      examples: [
        'resend contacts list',
        'resend contacts create --email steve.wozniak@gmail.com --first-name Steve',
        'resend contacts get e169aa45-1ecf-4183-9955-b1499d5701d3',
        'resend contacts get steve.wozniak@gmail.com',
        'resend contacts update acme@example.com --unsubscribed',
        'resend contacts delete e169aa45-1ecf-4183-9955-b1499d5701d3 --yes',
        'resend contacts segments steve.wozniak@gmail.com',
        'resend contacts add-segment steve.wozniak@gmail.com --segment-id 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend contacts remove-segment steve.wozniak@gmail.com 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend contacts topics steve.wozniak@gmail.com',
        `resend contacts update-topics steve.wozniak@gmail.com --topics '[{"id":"b6d24b8e-af0b-4c3c-be0c-359bbd97381e","subscription":"opt_in"}]'`,
      ],
    }),
  )
  .addCommand(createContactCommand)
  .addCommand(getContactCommand)
  .addCommand(listContactsCommand, { isDefault: true })
  .addCommand(updateContactCommand)
  .addCommand(deleteContactCommand)
  .addCommand(listContactSegmentsCommand)
  .addCommand(addContactSegmentCommand)
  .addCommand(removeContactSegmentCommand)
  .addCommand(listContactTopicsCommand)
  .addCommand(updateContactTopicsCommand);
