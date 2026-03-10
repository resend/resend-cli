import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { renderTopicsTable } from './utils';

export const listTopicsCommand = new Command('list')
  .alias('ls')
  .description('List all topics')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Returns all topics in your account. Topic subscription management for individual
contacts is handled via "resend contacts topics <contactId>".`,
      output: `  {"data":[{"id":"<uuid>","name":"<name>","description":"<desc>","default_subscription":"opt_in|opt_out","created_at":"<iso-date>"}]}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: ['resend topics list', 'resend topics list --json'],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    await runList(
      {
        spinner: {
          loading: 'Fetching topics...',
          success: 'Topics fetched',
          fail: 'Failed to list topics',
        },
        sdkCall: (resend) => resend.topics.list(),
        onInteractive: (list) => console.log(renderTopicsTable(list.data)),
      },
      globalOpts,
    );
  });
