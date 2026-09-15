import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { inboxThreadEmailsCommand } from './emails/index';
import { getInboxThreadCommand } from './get';
import { listInboxThreadsCommand } from './list';

export const inboxThreadsCommand = new Command('threads')
  .description('Browse and reply to email threads in an inbox')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Received messages are grouped into threads. "list" shows threads in a folder,
"get" returns a thread with full message bodies, and "emails reply" answers a
specific message from the inbox address.`,
      examples: [
        'resend inboxes threads list <inboxId>',
        'resend inboxes threads get <inboxId> <threadId>',
        'resend inboxes threads emails reply <inboxId> <threadId> <emailId> --text "Thanks!"',
      ],
    }),
  )
  .addCommand(listInboxThreadsCommand, { isDefault: true })
  .addCommand(getInboxThreadCommand)
  .addCommand(inboxThreadEmailsCommand);
