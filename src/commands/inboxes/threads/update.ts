import { Command, Option } from '@commander-js/extra-typings';
import { MOVE_THREAD_FOLDERS, type UpdateInboxThreadOptions } from 'resend';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, resolveIdInputs } from '../utils';
import { inboxThreadPickerConfig } from './utils';

export const updateInboxThreadCommand = new Command('update')
  .description(
    'Mark a thread read or unread, move it, or add and remove labels',
  )
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[threadId]', 'Thread UUID')
  .option('--inbox-id <id>', 'Inbox UUID')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .option('--read', 'Mark every message in the thread as read')
  .option('--unread', 'Mark every message in the thread as unread')
  .addOption(
    new Option('--folder <folder>', 'Move the thread to a folder').choices(
      MOVE_THREAD_FOLDERS,
    ),
  )
  .option(
    '--add-label-ids <label-ids...>',
    'Label UUIDs to apply to the thread, 1 to 10',
  )
  .addOption(snakeCaseAlias('--add-label-ids <label-ids...>'))
  .option(
    '--remove-label-ids <label-ids...>',
    'Label UUIDs to remove from the thread, 1 to 10',
  )
  .addOption(snakeCaseAlias('--remove-label-ids <label-ids...>'))
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --read/--unread, --folder, --add-label-ids, or --remove-label-ids
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
        'resend inboxes threads update <inbox-id> <thread-id> --read',
        'resend inboxes threads update <inbox-id> <thread-id> --folder archive --json',
        'resend inboxes threads update <inbox-id> <thread-id> --add-label-ids <label-id> --json',
        'resend inboxes threads update <inbox-id> <thread-id> --add-label-ids <label-id> --remove-label-ids <other-label-id>',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, opts, cmd) => {
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
      !opts.addLabelIds &&
      !opts.removeLabelIds
    ) {
      outputError(
        {
          message:
            'Provide at least one option to update: --read/--unread, --folder, --add-label-ids, or --remove-label-ids.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        thread: [threadIdArg, opts.threadId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      ids.thread,
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
      ...(opts.addLabelIds && { addLabelIds: opts.addLabelIds }),
      ...(opts.removeLabelIds && { removeLabelIds: opts.removeLabelIds }),
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
