import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { templatePickerConfig } from './utils';

export const deleteTemplateCommand = new Command('delete')
  .alias('rm')
  .description('Delete a template')
  .argument('[id]', 'Template ID or alias')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Warning: Deleting a template is permanent and cannot be undone.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"template","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend templates delete 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend templates delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
        'resend templates rm my-template-alias --yes',
        'resend templates delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, templatePickerConfig, globalOpts);
    await runDelete(
      id,
      !!opts.yes,
      {
        confirmMessage: `Delete template ${id}?\nThis action is permanent and cannot be undone.`,
        loading: 'Deleting template...',
        object: 'template',
        successMsg: 'Template deleted',
        sdkCall: (resend) => resend.templates.remove(id),
      },
      globalOpts,
    );
  });
