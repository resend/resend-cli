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
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[labelId]', 'Label UUID')
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
        'resend inboxes labels delete <inboxId> <labelId> --yes',
        'resend inboxes labels delete <inboxId> <labelId> --yes --json',
      ],
    }),
  )
  .action(async (inboxIdArg, labelIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(inboxIdArg, inboxPickerConfig, globalOpts);
    const picked = await pickItem(
      labelIdArg,
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
