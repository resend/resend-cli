import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { pickId } from '../../../../lib/prompts';
import { snakeCaseAlias } from '../../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';
import { printThreadLabels, requireLabelIds } from './utils';

export const addInboxThreadLabelsCommand = new Command('add')
  .description('Add labels to a thread')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .argument('[threadId]', 'Thread UUID')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .option(
    '--labels <label-ids...>',
    'Label UUIDs to add, 1 to 10, comma or space-separated (required)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Adds the labels to the thread. Labels already on the thread stay.
Each label must be a label of the inbox, from "resend inboxes labels list".
An unknown label returns an error and changes nothing.
The output lists every label on the thread after the change.`,
      output: `  {"object":"list","data":[{"id":"<uuid>","name":"<name>","color":"#RRGGBB"}]}`,
      errorCodes: [
        'auth_error',
        'missing_id',
        'missing_labels',
        'invalid_options',
        'update_error',
      ],
      examples: [
        'resend inboxes threads labels add <inbox-id> <thread-id> --labels <label-id>',
        'resend inboxes threads labels add support@yourdomain.com <thread-id> --labels <label-id> <other-label-id> --json',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const labels = requireLabelIds(opts.labels, globalOpts, {
      allowEmpty: false,
    });
    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        thread: [threadIdArg, opts.threadId],
      },
      globalOpts,
    );
    const inbox = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      ids.thread,
      inboxThreadPickerConfig(inbox),
      globalOpts,
    );
    await runCreate(
      {
        loading: 'Adding labels...',
        sdkCall: (resend) =>
          resend.inboxes.threads.labels.add({
            ...inboxSelector(inbox),
            threadId,
            labels,
          }),
        errorCode: 'update_error',
        onInteractive: (list) => printThreadLabels(threadId, list),
      },
      globalOpts,
    );
  });
