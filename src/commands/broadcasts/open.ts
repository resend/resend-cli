import { Command } from '@commander-js/extra-typings';
import { openInBrowserOrLog, RESEND_URLS } from '../../lib/browser';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const openBroadcastCommand = new Command('open')
  .description(
    'Open a broadcast or the broadcasts list in the Resend dashboard',
  )
  .argument('[id]', 'Broadcast ID — omit to open the broadcasts list')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Opens the Resend dashboard in your default browser.
  With an ID: opens that broadcast's page for viewing or editing.
  Without an ID: opens the broadcasts list.`,
      examples: [
        'resend broadcasts open',
        'resend broadcasts open d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
      ],
    }),
  )
  .action(async (id: string | undefined, _opts, cmd) => {
    const url = id ? RESEND_URLS.broadcast(id) : RESEND_URLS.broadcasts;
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await openInBrowserOrLog(url, globalOpts);
  });
