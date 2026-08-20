import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { cancelAndExit, pickId } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';
import { apiKeyPickerConfig } from './utils';

export const updateApiKeyCommand = new Command('update')
  .description('Rename an API key')
  .argument('[id]', 'API key ID')
  .option('--name <name>', 'New API key name (max 50 characters)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --name is required (no prompts when stdin/stdout is not a TTY).`,
      output: `  {"object":"api_key","id":"<id>"}`,
      errorCodes: ['auth_error', 'missing_name', 'update_error'],
      examples: [
        'resend api-keys update dacf4072-aa82-4ff3-97de-514ae3000ee0 --name "Production v2"',
        'resend api-keys update dacf4072-aa82-4ff3-97de-514ae3000ee0 --name "Production v2" --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, apiKeyPickerConfig, globalOpts);

    let name = opts.name;

    if (!name) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --name flag.', code: 'missing_name' },
          { json: globalOpts.json },
        );
      }

      const nameResult = await p.text({
        message: 'New key name',
        placeholder: 'e.g. Production v2',
        validate: (v) => {
          if (!v) {
            return 'Name is required';
          }
          if (v.length > 50) {
            return 'Name must be 50 characters or less';
          }
          return undefined;
        },
      });
      if (p.isCancel(nameResult)) {
        cancelAndExit('Cancelled.');
      }
      name = nameResult;
    }

    await runWrite(
      {
        loading: 'Updating API key...',
        sdkCall: (resend) => resend.apiKeys.update(id, { name }),
        errorCode: 'update_error',
        successMsg: `API key updated: ${id}`,
      },
      globalOpts,
    );
  });
