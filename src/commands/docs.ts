import { Command } from '@commander-js/extra-typings';
import { openInBrowserOrLog, RESEND_URLS } from '../lib/browser';
import type { GlobalOpts } from '../lib/client';
import { buildHelpText } from '../lib/help-text';

export const docsCommand = new Command('docs')
  .description('Open the Resend documentation in your browser')
  .addHelpText(
    'after',
    buildHelpText({
      context: 'Opens https://resend.com/docs in your default browser.',
      examples: ['resend docs'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    await openInBrowserOrLog(RESEND_URLS.documentation, globalOpts);
  });
