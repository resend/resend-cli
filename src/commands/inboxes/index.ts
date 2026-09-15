import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { buildHelpText } from '../../lib/help-text';
import { createInboxCommand } from './create';
import { deleteInboxCommand } from './delete';
import { getInboxCommand } from './get';
import { listInboxesCommand } from './list';
import { updateInboxCommand } from './update';

export const inboxesCommand = new Command('inboxes')
  .description(
    `${pc.cyan('● beta')} · Manage inboxes — email addresses at your domains that receive mail (request access to enable)`,
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Beta: this command requires inboxes to be enabled on your account.
Not enabled yet? Reach out to Resend to join the beta. Calls return an API error until then.

An inbox is an email address at one of your verified domains that can receive email.
Received messages are grouped into threads inside the inbox.

Inboxes require a full-access API key — sending-only keys are rejected.`,
      examples: [
        'resend inboxes list',
        'resend inboxes create --email-address support@yourdomain.com',
        'resend inboxes get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes update 78261eea-8f8b-4381-83c6-79fa7120f1cf --name "Support"',
        'resend inboxes delete 78261eea-8f8b-4381-83c6-79fa7120f1cf --yes',
      ],
    }),
  )
  .addCommand(createInboxCommand)
  .addCommand(getInboxCommand)
  .addCommand(listInboxesCommand, { isDefault: true })
  .addCommand(updateInboxCommand)
  .addCommand(deleteInboxCommand);
