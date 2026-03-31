import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { pickId } from '../../lib/prompts';
import { topicPickerConfig } from './utils';

export const updateTopicCommand = new Command('update')
  .description("Update a topic's name or description")
  .argument('[id]', 'Topic UUID')
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
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, topicPickerConfig, globalOpts);

    if (!opts.name && !opts.description) {
      outputError(
        {
          message:
            'Provide at least one option to update: --name or --description.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    await runWrite(
      {
        loading: 'Updating topic...',
        sdkCall: (resend) =>
          resend.topics.update({
            id,
            ...(opts.name && { name: opts.name }),
            ...(opts.description && { description: opts.description }),
          }),
        errorCode: 'update_error',
        successMsg: `Topic updated: ${id}`,
      },
      globalOpts,
    );
  });
