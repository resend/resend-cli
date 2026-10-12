import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { createInboxDraftCommand } from './create';
import { deleteInboxDraftCommand } from './delete';
import { getInboxDraftCommand } from './get';
import { listInboxDraftsCommand } from './list';
import { sendInboxDraftCommand } from './send';
import { updateInboxDraftCommand } from './update';

export const inboxDraftsCommand = new Command('drafts')
  .description('Manage email drafts in an inbox')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Drafts are unsent emails in an inbox — standalone, or replies when created
with --thread_id and --reply_to_email_id. Send one with "drafts send".`,
      examples: [
        'resend inboxes drafts list --inbox_id <inbox_id>',
        'resend inboxes drafts create --inbox_id <inbox_id> --to user@example.com --subject "Hello" --text "Body"',
        'resend inboxes drafts send --inbox_id <inbox_id> --draft_id <draft_id>',
      ],
    }),
  )
  .addCommand(listInboxDraftsCommand, { isDefault: true })
  .addCommand(createInboxDraftCommand)
  .addCommand(getInboxDraftCommand)
  .addCommand(updateInboxDraftCommand)
  .addCommand(deleteInboxDraftCommand)
  .addCommand(sendInboxDraftCommand);
