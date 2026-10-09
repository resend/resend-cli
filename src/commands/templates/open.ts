import { Command } from '@commander-js/extra-typings';
import { openInBrowserOrLog, RESEND_URLS } from '../../lib/browser';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { withSpinner } from '../../lib/spinner';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const openTemplateCommand = new Command('open')
  .description('Open a template or the templates list in the Resend dashboard')
  .argument('[id]', 'Template ID or alias — omit to open the templates list')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Opens the Resend dashboard in your default browser.
  With an ID or alias: opens that template's page for editing or viewing.
  Without an ID: opens the templates list.`,
      examples: [
        'resend templates open',
        'resend templates open 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates open my-template-alias',
      ],
    }),
  )
  .action(async (idOrAlias: string | undefined, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    if (!idOrAlias) {
      await openInBrowserOrLog(RESEND_URLS.templates, globalOpts);
      return;
    }

    // The dashboard only routes template pages by ID, so an alias would 404.
    const id = UUID_PATTERN.test(idOrAlias)
      ? idOrAlias
      : await resolveTemplateId(idOrAlias, globalOpts);
    await openInBrowserOrLog(RESEND_URLS.template(id), globalOpts);
  });

async function resolveTemplateId(alias: string, globalOpts: GlobalOpts) {
  const resend = await requireClient(globalOpts);
  const template = await withSpinner(
    'Finding template...',
    () => resend.templates.get(alias),
    'fetch_error',
    globalOpts,
    { retryTransient: true },
  );
  return template.id;
}
