import { Command } from '@commander-js/extra-typings';
import { runDelete } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId, pickItem } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const deleteInboxDraftCommand = new Command('delete')
  .alias('rm')
  .description('Delete a draft')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--draft_id <id>', 'Draft UUID')
  .option(
    '--yes',
    'Skip the confirmation prompt (required in non-interactive mode)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Non-interactive: --yes is required to confirm deletion when stdin/stdout is not a TTY.',
      output: `  {"object":"inbox_draft","id":"<uuid>","deleted":true}`,
      errorCodes: ['auth_error', 'confirmation_required', 'delete_error'],
      examples: [
        'resend inboxes drafts delete --inbox_id <inbox_id> --draft_id <draft_id> --yes',
        'resend inboxes drafts delete --inbox_id <inbox_id> --draft_id <draft_id> --yes --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const picked = await pickItem(
      opts.draft_id,
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
          resend.inboxes.drafts.remove({ inboxId, draftId: picked.id }),
      },
      globalOpts,
    );
  });
