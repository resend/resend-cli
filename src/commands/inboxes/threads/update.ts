import { Command, Option } from '@commander-js/extra-typings';
import { MOVE_THREAD_FOLDERS, type UpdateInboxThreadOptions } from 'resend';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxThreadPickerConfig } from './utils';

export const updateInboxThreadCommand = new Command('update')
  .description(
    'Mark a thread read or unread, move it, or add and remove labels',
  )
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--thread_id <id>', 'Thread UUID')
  .option('--read', 'Mark every message in the thread as read')
  .option('--unread', 'Mark every message in the thread as unread')
  .addOption(
    new Option('--folder <folder>', 'Move the thread to a folder').choices(
      MOVE_THREAD_FOLDERS,
    ),
  )
  .option(
    '--add_label_ids <label_ids...>',
    'Label UUIDs to apply to the thread, 1 to 10',
  )
  .option(
    '--remove_label_ids <label_ids...>',
    'Label UUIDs to remove from the thread, 1 to 10',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --read/--unread, --folder, --add_label_ids, or --remove_label_ids
is required.
A label ID cannot be both added and removed in the same request.
A label ID that does not exist in the inbox returns an error.
Removing a label from a thread keeps the label itself.
The changes apply in this order: read, folder, added labels, removed labels.
They are not atomic, so an unknown label leaves the earlier changes applied.
Threads cannot be moved to "sent". Moving a thread out of "trash" restores it
and clears its deletion deadline.`,
      output: `  {"object":"inbox_thread","id":"<uuid>","subject":"<subject>|null","folder":"inbox|archive|spam|sent|trash","labels":[],"read":true}`,
      errorCodes: [
        'auth_error',
        'invalid_options',
        'no_changes',
        'update_error',
      ],
      examples: [
        'resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --read',
        'resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --folder archive --json',
        'resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --add_label_ids <label_id> --json',
        'resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --add_label_ids <label_id> --remove_label_ids <other_label_id>',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (opts.read && opts.unread) {
      outputError(
        {
          message: 'Use either --read or --unread, not both.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    const read = opts.read ? true : opts.unread ? false : undefined;
    if (
      read === undefined &&
      !opts.folder &&
      !opts.add_label_ids &&
      !opts.remove_label_ids
    ) {
      outputError(
        {
          message:
            'Provide at least one option to update: --read/--unread, --folder, --add_label_ids, or --remove_label_ids.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      opts.thread_id,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );

    // The SDK requires at least one change at the type level, which the
    // no_changes guard above guarantees but tsc cannot prove across the
    // conditional spreads.
    const payload = {
      inboxId,
      threadId,
      ...(read !== undefined && { read }),
      ...(opts.folder && { folder: opts.folder }),
      ...(opts.add_label_ids && { addLabelIds: opts.add_label_ids }),
      ...(opts.remove_label_ids && { removeLabelIds: opts.remove_label_ids }),
    } as UpdateInboxThreadOptions;

    await runWrite(
      {
        loading: 'Updating thread...',
        sdkCall: (resend) => resend.inboxes.threads.update(payload),
        errorCode: 'update_error',
        successMsg: `Thread updated: ${threadId}`,
      },
      globalOpts,
    );
  });
