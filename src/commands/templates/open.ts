import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { DASHBOARD_URLS, openInBrowser } from '../../lib/browser';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const openTemplateCommand = new Command('open')
  .description('Open a template or the templates list in the Resend dashboard')
  .argument('[id]', 'Template ID or alias — omit to open the templates list')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Opens the Resend dashboard in your default browser.
  With an ID: opens that template's page for editing or viewing.
  Without an ID: opens the templates list.`,
      examples: [
        'resend templates open',
        'resend templates open 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates open my-template-alias',
      ],
    }),
  )
  .action((id: string | undefined, _opts, cmd) => {
    const url = id ? DASHBOARD_URLS.template(id) : DASHBOARD_URLS.templates;
    openInBrowser(url);
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    if (!globalOpts.json && !globalOpts.quiet) {
      console.log(pc.dim('Opening:'), pc.blue(url));
    }
  });
