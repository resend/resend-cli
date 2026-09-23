import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId, pickItem } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxLabelPickerConfig } from './utils';

export const deleteInboxLabelCommand = new Command('delete')
  .alias('rm')
  .description('Delete a label')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--label_id <id>', 'Label UUID')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `The label is removed from every thread that has it. Threads themselves are
not deleted.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"inbox_label","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend inboxes labels delete --inbox_id <inbox_id> --label_id <label_id> --yes',
        'resend inboxes labels delete --inbox_id <inbox_id> --label_id <label_id> --yes --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const picked = await pickItem(
      opts.label_id,
      inboxLabelPickerConfig(inboxId),
      globalOpts,
    );
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete label "${picked.label}"?\nID: ${picked.id}\nIt will be removed from every thread that has it.`,
        loading: 'Deleting label...',
        object: 'inbox_label',
        successMsg: 'Label deleted',
        sdkCall: (resend) =>
          resend.inboxes.labels.remove({ inboxId, labelId: picked.id }),
      },
      globalOpts,
    );
  });
