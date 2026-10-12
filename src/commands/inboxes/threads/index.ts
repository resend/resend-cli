import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { deleteInboxThreadCommand } from './delete';
import { inboxThreadEmailsCommand } from './emails/index';
import { getInboxThreadCommand } from './get';
import { listInboxThreadsCommand } from './list';
import { searchInboxThreadsCommand } from './search';
import { updateInboxThreadCommand } from './update';

export const inboxThreadsCommand = new Command('threads')
  .description('Browse and reply to email threads in an inbox')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Received messages are grouped into threads. "list" shows threads in a folder,
"search" finds threads by text, people, attachments, or dates, "get" returns
one thread's summary, "update" marks read/unread, moves, or labels a thread,
and "emails" lists and works with the messages in a thread.`,
      examples: [
        'resend inboxes threads list --inbox_id <inbox_id>',
        'resend inboxes threads search --inbox_id <inbox_id> --query invoice',
        'resend inboxes threads get --inbox_id <inbox_id> --thread_id <thread_id>',
        'resend inboxes threads emails list --inbox_id <inbox_id> --thread_id <thread_id>',
        'resend inboxes threads update --inbox_id <inbox_id> --thread_id <thread_id> --read',
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "Thanks!"',
      ],
    }),
  )
  .addCommand(listInboxThreadsCommand, { isDefault: true })
  .addCommand(searchInboxThreadsCommand)
  .addCommand(getInboxThreadCommand)
  .addCommand(updateInboxThreadCommand)
  .addCommand(deleteInboxThreadCommand)
  .addCommand(inboxThreadEmailsCommand);
