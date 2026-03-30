import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { getLogCommand } from './get';
import { listLogsCommand } from './list';
import { openLogsCommand } from './open';

export const logsCommand = new Command('logs')
  .description('View API request logs')
  .addHelpText(
    'after',
    buildHelpText({
      examples: [
        'resend logs list',
        'resend logs list --limit 25 --json',
        'resend logs get 3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55',
        'resend logs open',
        'resend logs open 3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55',
      ],
    }),
  )
  .addCommand(getLogCommand)
  .addCommand(listLogsCommand, { isDefault: true })
  .addCommand(openLogsCommand);
