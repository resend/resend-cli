import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { inboxAgentCommand } from './agent/index';
import { createInboxCommand } from './create';
import { deleteInboxCommand } from './delete';
import { inboxDraftsCommand } from './drafts/index';
import { getInboxCommand } from './get';
import { inboxLabelsCommand } from './labels/index';
import { listInboxesCommand } from './list';
import { inboxThreadsCommand } from './threads/index';
import { updateInboxCommand } from './update';

export const inboxesCommand = new Command('inboxes')
  .description(
    'Manage inboxes — email addresses at your domains that send and receive mail',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `An inbox is an email address at one of your verified domains that sends and receives email.
Received messages are grouped into threads inside the inbox.

The nested commands take their IDs as arguments, parent first: the inbox ID,
then the thread, draft or label ID, then the email ID. Each ID also has a flag,
such as --inbox-id or --thread-id.
Every command that names an inbox takes its ID or its email address, such as
support@yourdomain.com. The address match ignores case.

Most inbox commands need a full-access API key. A sending-access key can run
"threads emails reply", "threads emails forward", "drafts create" and
"drafts send". A key limited to one domain must match the domain of the inbox.
A sending-access key must pass every ID, because the ID pickers need full access.`,
      examples: [
        'resend inboxes list',
        'resend inboxes create --email-address support@yourdomain.com',
        'resend inboxes get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes threads list support@yourdomain.com',
        'resend inboxes update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Support"',
        'resend inboxes delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
      ],
    }),
  )
  .addCommand(createInboxCommand)
  .addCommand(getInboxCommand)
  .addCommand(listInboxesCommand, { isDefault: true })
  .addCommand(inboxThreadsCommand)
  .addCommand(inboxLabelsCommand)
  .addCommand(inboxDraftsCommand)
  .addCommand(inboxAgentCommand)
  .addCommand(updateInboxCommand)
  .addCommand(deleteInboxCommand);
