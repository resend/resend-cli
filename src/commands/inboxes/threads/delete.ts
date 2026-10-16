import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputResult } from '../../../lib/output';
import { confirmDelete, pickId, pickItem } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { withSpinner } from '../../../lib/spinner';
import { isInteractive } from '../../../lib/tty';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';
import { inboxThreadPickerConfig } from './utils';

export const deleteInboxThreadCommand = new Command('delete')
  .alias('rm')
  .description('Move a thread to trash and schedule it for deletion in 30 days')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .argument('[threadId]', 'Thread UUID')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Moves the thread to "trash" and schedules it for deletion in 30 days.
This is reversible. To restore the thread, move it to "inbox", "archive", or "spam"
with "resend inboxes threads update --folder". That also clears the deletion deadline.
"deleted" is false when the thread was already in trash.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"inbox_thread","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend inboxes threads delete <inbox-id> <thread-id> --yes',
        'resend inboxes threads delete <inbox-id> <thread-id> --yes --json',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        thread: [threadIdArg, opts.threadId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const picked = await pickItem(
      ids.thread,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );
    const resend = await requireClient(globalOpts);
    if (!opts.yes) {
      await confirmDelete(
        picked.id,
        `Move thread "${picked.label}" to trash?\nID: ${picked.id}\nIt is deleted in 30 days unless you move it out of trash.`,
        globalOpts,
      );
    }
    const data = await withSpinner(
      'Moving thread to trash...',
      () =>
        resend.inboxes.threads.remove({
          ...inboxSelector(inboxId),
          threadId: picked.id,
        }),
      'delete_error',
      globalOpts,
    );
    if (!globalOpts.json && isInteractive()) {
      console.log(
        data.deleted ? 'Thread moved to trash' : 'Thread was already in trash',
      );
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
