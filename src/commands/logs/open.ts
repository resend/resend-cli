import { Command } from '@commander-js/extra-typings';
import { openInBrowserOrLog, RESEND_URLS } from '../../lib/browser';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const openLogsCommand = new Command('open')
  .description('Open the logs page in the Resend dashboard')
  .addHelpText(
    'after',
    buildHelpText({
      context: 'Opens the Resend dashboard logs page in your default browser.',
      examples: ['resend logs open'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await openInBrowserOrLog(RESEND_URLS.logs, globalOpts);
  });
