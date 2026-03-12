import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';

export const duplicateTemplateCommand = new Command('duplicate')
  .description('Duplicate a template')
  .argument('<id>', 'Template ID or alias to duplicate')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Creates a copy of an existing template and returns the new template ID.
The duplicate is created as a draft with " (Copy)" appended to the original name.
All fields (HTML, subject, variables, etc.) are copied to the new template.`,
      output: `  {"object":"template","id":"<new-template-id>"}`,
      errorCodes: ['auth_error', 'create_error'],
      examples: [
        'resend templates duplicate 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates duplicate my-template-alias --json',
      ],
    }),
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await runCreate(
      {
        spinner: {
          loading: 'Duplicating template...',
          success: 'Template duplicated',
          fail: 'Failed to duplicate template',
        },
        sdkCall: (resend) => Promise.resolve(resend.templates.duplicate(id)),
        onInteractive: (d) => {
          console.log(`\nTemplate duplicated: ${d.id}`);
        },
      },
      globalOpts,
    );
  });
