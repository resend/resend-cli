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
  .description('Manage contacts — the global list of people you send email to')
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
        'resend contacts create --email jane@example.com --first-name Jane',
        'resend contacts get 479e3145-dd38-4932-8c0c-e58b548c9e76',
        'resend contacts get user@example.com',
        'resend contacts update user@example.com --unsubscribed',
        'resend contacts delete 479e3145-dd38-4932-8c0c-e58b548c9e76 --yes',
        'resend contacts segments user@example.com',
        'resend contacts add-segment user@example.com --segment-id seg_123',
        'resend contacts remove-segment user@example.com seg_123',
        'resend contacts topics user@example.com',
        `resend contacts update-topics user@example.com --topics '[{"id":"topic-uuid","subscription":"opt_in"}]'`,
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
