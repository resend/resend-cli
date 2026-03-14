import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { DASHBOARD_URLS, openInBrowser } from '../lib/browser';
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
  .action((_opts, cmd) => {
    const url = DASHBOARD_URLS.emails;
    openInBrowser(url);
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    if (!globalOpts.json && !globalOpts.quiet) {
      console.log(pc.dim('Opening:'), pc.blue(url));
    }
  });
