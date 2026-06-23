import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { createContactImportCommand } from './create';
import { getContactImportCommand } from './get';
import { listContactImportsCommand } from './list';

export const contactImportsCommand = new Command('imports')
  .description('Import contacts in bulk from a CSV file')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Import lifecycle:
  1. resend contacts imports create --file ./contacts.csv   (returns the import id)
  2. resend contacts imports get <id>                       (poll until "completed")
  3. resend contacts imports list                           (review past imports)

Imports run asynchronously. The create command returns immediately with an id while
the file is processed in the background.`,
      examples: [
        'resend contacts imports create --file ./contacts.csv',
        'resend contacts imports get 479e3145-dd38-476b-932c-529ceb705947',
        'resend contacts imports list --status completed',
      ],
    }),
  )
  .addCommand(createContactImportCommand)
  .addCommand(getContactImportCommand)
  .addCommand(listContactImportsCommand, { isDefault: true });
