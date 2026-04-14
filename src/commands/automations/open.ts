import { Command } from '@commander-js/extra-typings';
import { openInBrowserOrLog, RESEND_URLS } from '../../lib/browser';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const openAutomationCommand = new Command('open')
  .description(
    'Open an automation or the automations list in the Resend dashboard',
  )
  .argument('[id]', 'Automation ID — omit to open the automations list')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Opens the Resend dashboard in your default browser.
  With an ID: opens that automation's editor.
  Without an ID: opens the automations list.`,
      examples: [
        'resend automations open',
        'resend automations open 019d4ef1-8266-71d4-a1aa-60ce5d0eaea7',
      ],
    }),
  )
  .action(async (id: string | undefined, _opts, cmd) => {
    const url = id ? RESEND_URLS.automation(id) : RESEND_URLS.automations;
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await openInBrowserOrLog(url, globalOpts);
  });
