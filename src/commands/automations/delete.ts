import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { automationPickerConfig } from './utils';

export const deleteAutomationCommand = new Command('delete')
  .alias('rm')
  .description('Delete an automation')
  .argument('[id]', 'Automation ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.',
      output: '  {"object":"automation","id":"<id>","deleted":true}',
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend automations delete <id> --yes',
        'resend automations delete <id> --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, automationPickerConfig, globalOpts);
    await runDelete(
      id,
      !!opts.yes,
      {
        confirmMessage: `Delete automation ${id}?\nThis cannot be undone.`,
        loading: 'Deleting automation...',
        object: 'automation',
        successMsg: 'Automation deleted',
        sdkCall: (resend) => resend.automations.remove(id),
      },
      globalOpts,
    );
  });
