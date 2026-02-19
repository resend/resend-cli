import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { renderApiKeysTable } from './utils';

export const listApiKeysCommand = new Command('list')
  .description('List all API keys (IDs and names — tokens are never returned by this endpoint)')
  .addHelpText(
    'after',
    `
Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"list","data":[{"id":"<id>","name":"<name>","created_at":"<date>"}]}
  Tokens are never included in list responses.

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | list_error

Examples:
  $ resend api-keys list
  $ resend api-keys list --json`
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching API keys...');

    try {
      const { data, error } = await resend.apiKeys.list();

      if (error) {
        spinner.fail('Failed to list API keys');
        outputError({ message: error.message, code: 'list_error' }, { json: globalOpts.json });
      }

      spinner.stop('API keys fetched');

      const list = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(renderApiKeysTable(list.data));
      } else {
        outputResult(list, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to list API keys');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'list_error' },
        { json: globalOpts.json }
      );
    }
  });
