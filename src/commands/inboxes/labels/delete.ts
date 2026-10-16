import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId, pickItem } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';
import { inboxLabelPickerConfig } from './utils';

export const deleteInboxLabelCommand = new Command('delete')
  .alias('rm')
  .description('Delete a label')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .argument('[labelId]', 'Label UUID')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--label-id <id>', 'Label UUID')
  .addOption(snakeCaseAlias('--label-id <id>'))
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
        'resend inboxes labels delete <inbox-id> <label-id> --yes',
        'resend inboxes labels delete <inbox-id> <label-id> --yes --json',
      ],
    }),
  )
  .action(async (inboxIdArg, labelIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        label: [labelIdArg, opts.labelId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const picked = await pickItem(
      ids.label,
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
          resend.inboxes.labels.remove({
            ...inboxSelector(inboxId),
            labelId: picked.id,
          }),
      },
      globalOpts,
    );
  });
