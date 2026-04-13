import { Command } from '@commander-js/extra-typings';
import { openInBrowserOrLog, RESEND_URLS } from '../../lib/browser';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const openEventsCommand = new Command('open')
  .description('Open the events page in the Resend dashboard')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Opens the events management page in the Resend dashboard in your default browser.',
      examples: ['resend events open'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await openInBrowserOrLog(RESEND_URLS.events, globalOpts);
  });
