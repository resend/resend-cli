import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickItem } from '../../lib/prompts';
import { domainPickerConfig } from './utils';

export const deleteDomainCommand = new Command('delete')
  .alias('rm')
  .description('Delete a domain')
  .argument('[id]', 'Domain ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.',
      output: '  {"object":"domain","id":"<id>","deleted":true}',
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend domains delete 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --yes',
        'resend domains delete 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(idArg, domainPickerConfig, globalOpts);
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete domain "${picked.label}"?\nID: ${picked.id}\nThis cannot be undone.`,
        loading: 'Deleting domain...',
        object: 'domain',
        successMsg: 'Domain deleted',
        sdkCall: (resend) => resend.domains.remove(picked.id),
      },
      globalOpts,
    );
  });
