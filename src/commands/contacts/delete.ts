import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { contactPickerConfig } from './utils';

export const deleteContactCommand = new Command('delete')
  .alias('rm')
  .description('Delete a contact')
  .argument(
    '[id]',
    'Contact UUID or email address — both are accepted by the API',
  )
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <id> argument accepts either a UUID or an email address.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"contact","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend contacts delete 479e3145-dd38-4932-8c0c-e58b548c9e76 --yes',
        'resend contacts delete user@example.com --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPickerConfig, globalOpts);
    await runDelete(
      id,
      !!opts.yes,
      {
        confirmMessage: `Delete contact ${id}?\nThis cannot be undone.`,
        spinner: {
          loading: 'Deleting contact...',
          success: 'Contact deleted',
          fail: 'Failed to delete contact',
        },
        object: 'contact',
        successMsg: 'Contact deleted.',
        sdkCall: (resend) => resend.contacts.remove(id),
      },
      globalOpts,
    );
  });
