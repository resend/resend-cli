import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { confirmDelete } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const deleteDomainCommand = new Command('delete')
  .description('Delete a domain')
  .argument('<id>', 'Domain ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context: 'Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.',
      output: '  {"object":"domain","id":"<id>","deleted":true}',
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend domains delete 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --yes',
        'resend domains delete 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --yes --json',
      ],
    })
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    if (!opts.yes) {
      await confirmDelete(id, `Delete domain ${id}? This cannot be undone.`, globalOpts);
    }

    const spinner = createSpinner('Deleting domain...');

    try {
      const { error } = await resend.domains.remove(id);

      if (error) {
        spinner.fail('Failed to delete domain');
        outputError({ message: error.message, code: 'delete_error' }, { json: globalOpts.json });
      }

      spinner.stop('Domain deleted');

      if (!globalOpts.json && isInteractive()) {
        console.log('Domain deleted.');
      } else {
        outputResult({ object: 'domain', id, deleted: true }, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to delete domain');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'delete_error' },
        { json: globalOpts.json }
      );
    }
  });
