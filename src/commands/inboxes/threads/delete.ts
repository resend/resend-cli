import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId, pickItem } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxThreadPickerConfig } from './utils';

export const deleteInboxThreadCommand = new Command('delete')
  .alias('rm')
  .description('Delete a thread and all of its messages')
  .option('--inbox-id <id>', 'Inbox UUID')
  .option('--thread-id <id>', 'Thread UUID')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.',
      output: `  {"object":"inbox_thread","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend inboxes threads delete --inbox-id <inboxId> --thread-id <threadId> --yes',
        'resend inboxes threads delete --inbox-id <inboxId> --thread-id <threadId> --yes --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inboxId, inboxPickerConfig, globalOpts);
    const picked = await pickItem(
      opts.threadId,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete thread "${picked.label}"?\nID: ${picked.id}\nAll messages in this thread will be removed.`,
        loading: 'Deleting thread...',
        object: 'inbox_thread',
        successMsg: 'Thread deleted',
        sdkCall: (resend) =>
          resend.inboxes.threads.remove({ inboxId, threadId: picked.id }),
      },
      globalOpts,
    );
  });
