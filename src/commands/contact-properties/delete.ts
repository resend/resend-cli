import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickItem } from '../../lib/prompts';
import { contactPropertyPickerConfig } from './utils';

export const deleteContactPropertyCommand = new Command('delete')
  .alias('rm')
  .description('Delete a contact property definition')
  .argument('[id]', 'Contact property UUID')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `WARNING: Deleting a property definition removes that property value from ALL contacts
permanently. This cannot be undone, and any broadcasts that reference this property key
via {{{PROPERTY_NAME}}} will render an empty string or their inline fallback instead.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"contact_property","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend contact-properties delete b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d --yes',
        'resend contact-properties delete b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(
      idArg,
      contactPropertyPickerConfig,
      globalOpts,
    );
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete contact property "${picked.label}"?\nID: ${picked.id}\nThis will remove this property from ALL contacts permanently.`,
        loading: 'Deleting contact property...',
        object: 'contact_property',
        successMsg: 'Contact property deleted',
        sdkCall: (resend) => resend.contactProperties.remove(picked.id),
      },
      globalOpts,
    );
  });
