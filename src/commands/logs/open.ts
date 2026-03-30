import { Command } from '@commander-js/extra-typings';
import { openInBrowserOrLog, RESEND_URLS } from '../../lib/browser';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const openLogsCommand = new Command('open')
  .description('Open a log or the logs list in the Resend dashboard')
  .argument('[id]', 'Log ID — omit to open the logs list')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Opens the Resend dashboard in your default browser.
  With an ID: opens that log's detail page.
  Without an ID: opens the logs list.`,
      examples: [
        'resend logs open',
        'resend logs open 3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55',
      ],
    }),
  )
  .action(async (id: string | undefined, _opts, cmd) => {
    const url = id ? RESEND_URLS.log(id) : RESEND_URLS.logs;
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await openInBrowserOrLog(url, globalOpts);
  });
