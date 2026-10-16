import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { deleteInboxThreadCommand } from './delete';
import { inboxThreadEmailsCommand } from './emails/index';
import { getInboxThreadCommand } from './get';
import { inboxThreadLabelsCommand } from './labels/index';
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
one thread's summary, "update" marks read/unread or moves a thread, "labels"
adds, replaces, or removes the labels on a thread, and "emails" lists and works
with the messages in a thread.`,
      examples: [
        'resend inboxes threads list <inbox-id>',
        'resend inboxes threads search <inbox-id> --query invoice',
        'resend inboxes threads get <inbox-id> <thread-id>',
        'resend inboxes threads emails list <inbox-id> <thread-id>',
        'resend inboxes threads update <inbox-id> <thread-id> --read',
        'resend inboxes threads labels add <inbox-id> <thread-id> --labels <label-id>',
        'resend inboxes threads emails reply <inbox-id> <thread-id> <email-id> --text "Thanks!"',
      ],
    }),
  )
  .addCommand(listInboxThreadsCommand, { isDefault: true })
  .addCommand(searchInboxThreadsCommand)
  .addCommand(getInboxThreadCommand)
  .addCommand(updateInboxThreadCommand)
  .addCommand(deleteInboxThreadCommand)
  .addCommand(inboxThreadLabelsCommand)
  .addCommand(inboxThreadEmailsCommand);
