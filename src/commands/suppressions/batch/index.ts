import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { batchAddSuppressionsCommand } from './add';
import { batchRemoveSuppressionsCommand } from './remove';

export const batchSuppressionsCommand = new Command('batch')
  .description('Suppress or remove many addresses in a single request')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Batch operations read a JSON array of strings from --file (up to 100 per request).
"add" always operates on emails. "remove" defaults to emails; pass --ids to remove by ID.`,
      examples: [
        'resend suppressions batch add --file ./emails.json',
        'resend suppressions batch remove --file ./emails.json',
        'resend suppressions batch remove --file ./ids.json --ids',
      ],
    }),
  )
  .addCommand(batchAddSuppressionsCommand)
  .addCommand(batchRemoveSuppressionsCommand);
