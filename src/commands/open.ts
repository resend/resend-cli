import { Command } from '@commander-js/extra-typings';
import { openInBrowserOrLog, RESEND_URLS } from '../lib/browser';
import type { GlobalOpts } from '../lib/client';
import { buildHelpText } from '../lib/help-text';

export const openCommand = new Command('open')
  .description('Open the Resend dashboard in your browser')
  .addHelpText(
    'after',
    buildHelpText({
      context: 'Opens https://resend.com/emails in your default browser.',
      examples: ['resend open'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await openInBrowserOrLog(RESEND_URLS.emails, globalOpts);
  });
