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
  .description('Mark a thread read or unread, move it, or apply a label')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--thread_id <id>', 'Thread UUID')
  .option('--read', 'Mark every message in the thread as read')
  .option('--unread', 'Mark every message in the thread as unread')
  .addOption(
    new Option('--folder <folder>', 'Move the thread to a folder').choices(
      MOVE_THREAD_FOLDERS,
    ),
  )
  .option('--label_id <label_id>', 'Apply this label (UUID) to the thread')
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --read/--unread, --folder, or --label_id is required.
Threads cannot be moved to "sent".`,
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
        'resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --label_id <label_id> --json',
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
    if (read === undefined && !opts.folder && !opts.label_id) {
      outputError(
        {
          message:
            'Provide at least one option to update: --read/--unread, --folder, or --label_id.',
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
      ...(opts.label_id && { labelId: opts.label_id }),
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
