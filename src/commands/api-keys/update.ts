import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { pickId, requireText } from '../../lib/prompts';
import { apiKeyPickerConfig } from './utils';

export const updateApiKeyCommand = new Command('update')
  .description('Rename an API key')
  .argument('[id]', 'API key ID')
  .option('--name <name>', 'New API key name')
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

    const name = await requireText(
      opts.name,
      {
        message: 'New key name',
        placeholder: 'e.g. Production v2',
        validate: (v) => {
          if (!v) {
            return 'Name is required';
          }
          return undefined;
        },
      },
      { message: 'Missing --name flag.', code: 'missing_name' },
      globalOpts,
    );

    if (!name) {
      outputError(
        { message: 'Name is required.', code: 'missing_name' },
        { json: globalOpts.json },
      );
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
