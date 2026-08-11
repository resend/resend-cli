import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { buildHelpText } from '../../lib/help-text';
import { addSuppressionCommand } from './add';
import { batchSuppressionsCommand } from './batch/index';
import { deleteSuppressionCommand } from './delete';
import { getSuppressionCommand } from './get';
import { listSuppressionsCommand } from './list';

export const suppressionsCommand = new Command('suppressions')
  .description(
    "Manage the suppression list — addresses that won't receive your emails",
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Suppressions block future sends to an address. Entries have an origin:
  bounce     added automatically after a hard bounce
  complaint  added automatically after a spam complaint
  manual     added by you via "suppressions add"

get/delete accept either a suppression ID or the email address.`,
      examples: [
        'resend suppressions list',
        'resend suppressions add spam@example.com',
        'resend suppressions get spam@example.com',
        'resend suppressions delete spam@example.com --yes',
        'resend suppressions batch add --file ./emails.json',
      ],
    }),
  )
  .addCommand(listSuppressionsCommand, { isDefault: true })
  .addCommand(addSuppressionCommand)
  .addCommand(getSuppressionCommand)
  .addCommand(deleteSuppressionCommand)
  .addCommand(batchSuppressionsCommand);
