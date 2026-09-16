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
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[threadId]', 'Thread UUID')
  .option('--read', 'Mark every message in the thread as read')
  .option('--unread', 'Mark every message in the thread as unread')
  .addOption(
    new Option('--folder <folder>', 'Move the thread to a folder').choices(
      MOVE_THREAD_FOLDERS,
    ),
  )
  .option('--label-id <labelId>', 'Apply this label (UUID) to the thread')
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --read/--unread, --folder, or --label-id is required.
Threads cannot be moved to "sent".`,
      output: `  {"object":"inbox_thread","id":"<uuid>","subject":"<subject>|null","folder":"inbox|archive|spam|sent|trash","labels":[],"read":true}`,
      errorCodes: [
        'auth_error',
        'invalid_options',
        'no_changes',
        'update_error',
      ],
      examples: [
        'resend inboxes threads update <inboxId> <threadId> --read',
        'resend inboxes threads update <inboxId> <threadId> --folder archive --json',
        'resend inboxes threads update <inboxId> <threadId> --label-id <labelId> --json',
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
    if (read === undefined && !opts.folder && !opts.labelId) {
      outputError(
        {
          message:
            'Provide at least one option to update: --read/--unread, --folder, or --label-id.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const inboxId = await pickId(inboxIdArg, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      threadIdArg,
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
      ...(opts.labelId && { labelId: opts.labelId }),
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
