import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const deleteContactPropertyCommand = new Command('delete')
  .description('Delete a contact property definition')
  .argument('<id>', 'Contact property UUID')
  .option('--yes', 'Skip the confirmation prompt (required in non-interactive mode)')
  .addHelpText(
    'after',
    `
WARNING: Deleting a property definition removes that property value from ALL contacts
permanently. This cannot be undone, and any broadcasts that reference this property key
via {{{PROPERTY_NAME}}} will render an empty string or their inline fallback instead.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"contact_property","id":"<id>","deleted":true}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | confirmation_required | delete_error

Examples:
  $ resend contact-properties delete prop_abc123 --yes
  $ resend contact-properties delete prop_abc123 --yes --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(
        id,
        `Delete contact property "${id}"? This will remove this property from ALL contacts permanently.`,
        globalOpts
      );
    }

    const spinner = createSpinner('Deleting contact property...');

    try {
      const { error } = await resend.contactProperties.remove(id);

      if (error) {
        spinner.fail('Failed to delete contact property');
        outputError({ message: error.message, code: 'delete_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact property deleted');

      if (!globalOpts.json && isInteractive()) {
        console.log('Contact property deleted.');
      } else {
        outputResult({ object: 'contact_property', id, deleted: true }, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to delete contact property');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'delete_error' }, { json: globalOpts.json });
    }
  });
