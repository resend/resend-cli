import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { renderApiKeysTable } from './utils';

export const listApiKeysCommand = new Command('list')
  .alias('ls')
  .description(
    'List all API keys (IDs and names — tokens are never returned by this endpoint)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"list","data":[{"id":"<id>","name":"<name>","created_at":"<date>"}]}
  Tokens are never included in list responses.`,
      errorCodes: ['auth_error', 'list_error'],
      examples: ['resend api-keys list', 'resend api-keys list --json'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await runList(
      {
        spinner: {
          loading: 'Fetching API keys...',
          success: 'API keys fetched',
          fail: 'Failed to list API keys',
        },
        sdkCall: (resend) => resend.apiKeys.list(),
        onInteractive: (list) => console.log(renderApiKeysTable(list.data)),
      },
      globalOpts,
    );
  });
