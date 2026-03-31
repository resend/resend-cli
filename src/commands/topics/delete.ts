import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { topicPickerConfig } from './utils';

export const deleteTopicCommand = new Command('delete')
  .alias('rm')
  .description('Delete a topic')
  .argument('[id]', 'Topic UUID')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Warning: Deleting a topic removes all contact subscriptions to that topic and may affect
  broadcasts that reference this topic_id. Contacts themselves are not deleted.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"topic","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend topics delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
        'resend topics delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, topicPickerConfig, globalOpts);
    await runDelete(
      id,
      !!opts.yes,
      {
        confirmMessage: `Delete topic ${id}?\nAll contact subscriptions and broadcast associations will be removed.`,
        loading: 'Deleting topic...',
        object: 'topic',
        successMsg: 'Topic deleted',
        sdkCall: (resend) => resend.topics.remove(id),
      },
      globalOpts,
    );
  });
