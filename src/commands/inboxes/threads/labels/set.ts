import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { pickId } from '../../../../lib/prompts';
import { snakeCaseAlias } from '../../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';
import { printThreadLabels, requireLabelIds } from './utils';

export const setInboxThreadLabelsCommand = new Command('set')
  .description('Replace every label on a thread')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .argument('[threadId]', 'Thread UUID')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .option(
    '--labels <label-ids...>',
    'Label UUIDs the thread keeps, 0 to 100, comma or space-separated (required). Pass "" to remove every label',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Replaces every label on the thread in one atomic change.
Pass --labels "" to remove every label from the thread.
The labels themselves are kept.
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
        'resend inboxes threads labels set <inbox-id> <thread-id> --labels <label-id> <other-label-id>',
        'resend inboxes threads labels set <inbox-id> <thread-id> --labels "" --json',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const labels = requireLabelIds(opts.labels, globalOpts, {
      allowEmpty: true,
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
        loading: 'Setting labels...',
        sdkCall: (resend) =>
          resend.inboxes.threads.labels.set({
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
