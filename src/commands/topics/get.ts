import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const getTopicCommand = new Command('get')
  .description('Retrieve a topic by ID')
  .argument('<id>', 'Topic UUID')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"id":"<uuid>","name":"<name>","description":"<desc>","default_subscription":"opt_in|opt_out","created_at":"<iso-date>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend topics get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend topics get 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const data = await withSpinner(
      { loading: 'Fetching topic...', success: 'Topic fetched', fail: 'Failed to fetch topic' },
      () => resend.topics.get(id),
      'fetch_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`\n${data.name}`);
      console.log(`ID: ${data.id}`);
      if (data.description) console.log(`Description: ${data.description}`);
      console.log(`Default subscription: ${data.default_subscription}`);
      console.log(`Created: ${data.created_at}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
