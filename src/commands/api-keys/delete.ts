import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickItem } from '../../lib/prompts';
import { apiKeyPickerConfig } from './utils';

export const deleteApiKeyCommand = new Command('delete')
  .alias('rm')
  .description(
    'Delete an API key — any services using it will immediately lose access',
  )
  .argument('[id]', 'API key ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.

Warning: Deleting a key is immediate and irreversible. Any service using this key
will stop authenticating instantly. The current key (used to call this command)
can delete itself — the API does not prevent self-deletion.`,
      output: `  {"object":"api-key","id":"<id>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend api-keys delete dacf4072-aa82-4ff3-97de-514ae3000ee0 --yes',
        'resend api-keys delete dacf4072-aa82-4ff3-97de-514ae3000ee0 --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(idArg, apiKeyPickerConfig, globalOpts);
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete API key "${picked.label}"?\nID: ${picked.id}\nAny services using this key will stop working.`,
        loading: 'Deleting API key...',
        object: 'api-key',
        successMsg: 'API key deleted',
        sdkCall: (resend) => resend.apiKeys.remove(picked.id),
      },
      globalOpts,
    );
  });
