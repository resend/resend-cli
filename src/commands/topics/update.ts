import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const updateTopicCommand = new Command('update')
  .description("Update a topic's name or description")
  .argument('<id>', 'Topic UUID')
  .option('--name <name>', 'New topic name')
  .option('--description <description>', 'New description shown to contacts')
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --name or --description must be provided to update the topic.

Note: --default-subscription cannot be changed after creation.
To change the default subscription, delete the topic and recreate it.`,
      output: `  {"id":"<uuid>"}`,
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend topics update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Security Alerts"',
        'resend topics update 78261eea-8f8b-4381-83c6-79fa7120f1cf --description "Critical notices" --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (!opts.name && !opts.description) {
      outputError(
        { message: 'Provide at least one option to update: --name or --description.', code: 'no_changes' },
        { json: globalOpts.json }
      );
    }

    const data = await withSpinner(
      { loading: 'Updating topic...', success: 'Topic updated', fail: 'Failed to update topic' },
      () => resend.topics.update({
        id,
        ...(opts.name && { name: opts.name }),
        ...(opts.description && { description: opts.description }),
      }),
      'update_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`Topic updated: ${id}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
