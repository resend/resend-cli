import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { pickId } from '../../../../lib/prompts';
import { snakeCaseAlias } from '../../../../lib/snake-case-alias';
import { inboxLabelPickerConfig } from '../../labels/utils';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';
import { printThreadLabels } from './utils';

export const removeInboxThreadLabelCommand = new Command('remove')
  .description('Remove a label from a thread')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .argument('[threadId]', 'Thread UUID')
  .argument('[labelId]', 'Label UUID')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .option('--label-id <id>', 'Label UUID')
  .addOption(snakeCaseAlias('--label-id <id>'))
  .addHelpText(
    'after',
    buildHelpText({
      context: `Removes one label from the thread. The label itself is kept.
To delete the label from the inbox, use "resend inboxes labels delete".
A label that is not on the thread changes nothing.
The output lists every label on the thread after the change.`,
      output: `  {"object":"list","data":[{"id":"<uuid>","name":"<name>","color":"#RRGGBB"}]}`,
      errorCodes: [
        'auth_error',
        'missing_id',
        'invalid_options',
        'update_error',
      ],
      examples: [
        'resend inboxes threads labels remove <inbox-id> <thread-id> <label-id>',
        'resend inboxes threads labels remove <inbox-id> <thread-id> <label-id> --json',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, labelIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        thread: [threadIdArg, opts.threadId],
        label: [labelIdArg, opts.labelId],
      },
      globalOpts,
    );
    const inbox = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      ids.thread,
      inboxThreadPickerConfig(inbox),
      globalOpts,
    );
    const labelId = await pickId(
      ids.label,
      inboxLabelPickerConfig(inbox),
      globalOpts,
    );
    await runCreate(
      {
        loading: 'Removing label...',
        sdkCall: (resend) =>
          resend.inboxes.threads.labels.remove({
            ...inboxSelector(inbox),
            threadId,
            labelId,
          }),
        errorCode: 'update_error',
        onInteractive: (list) => printThreadLabels(threadId, list),
      },
      globalOpts,
    );
  });
