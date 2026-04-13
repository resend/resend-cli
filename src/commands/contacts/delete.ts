import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickItem } from '../../lib/prompts';
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
        'resend contacts delete 520784e2-887d-4c25-b53c-4ad46ad38100 --yes',
        'resend contacts delete acme@example.com --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(idArg, contactPickerConfig, globalOpts);
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete contact "${picked.label}"?\nID: ${picked.id}\nThis cannot be undone.`,
        loading: 'Deleting contact...',
        object: 'contact',
        successMsg: 'Contact deleted',
        sdkCall: (resend) => resend.contacts.remove(picked.id),
      },
      globalOpts,
    );
  });
