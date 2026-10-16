import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId, pickItem } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const deleteInboxDraftCommand = new Command('delete')
  .alias('rm')
  .description('Delete a draft')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .argument('[draftId]', 'Draft UUID')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--draft-id <id>', 'Draft UUID')
  .addOption(snakeCaseAlias('--draft-id <id>'))
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Discards an unsent draft. A draft that was already sent returns an error.

Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.`,
      output: `  {"object":"inbox_draft","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend inboxes drafts delete <inbox-id> <draft-id> --yes',
        'resend inboxes drafts delete <inbox-id> <draft-id> --yes --json',
      ],
    }),
  )
  .action(async (inboxIdArg, draftIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        draft: [draftIdArg, opts.draftId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const picked = await pickItem(
      ids.draft,
      inboxDraftPickerConfig(inboxId),
      globalOpts,
    );
    await runDelete(
      picked.id,
      !!opts.yes,
      {
        confirmMessage: `Delete draft "${picked.label}"?\nID: ${picked.id}`,
        loading: 'Deleting draft...',
        object: 'inbox_draft',
        successMsg: 'Draft deleted',
        sdkCall: (resend) =>
          resend.inboxes.drafts.remove({
            ...inboxSelector(inboxId),
            draftId: picked.id,
          }),
      },
      globalOpts,
    );
  });
