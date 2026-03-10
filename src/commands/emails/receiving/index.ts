import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { getAttachmentCommand } from './attachment';
import { listAttachmentsCommand } from './attachments';
import { getReceivingCommand } from './get';
import { listReceivingCommand } from './list';

export const receivingCommand = new Command('receiving')
  .description(
    'Manage received (inbound) emails — requires domain receiving to be enabled',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Receiving must be enabled on the domain first:\n  resend domains update <id> --receiving enabled',
      examples: [
        'resend emails receiving list',
        'resend emails receiving get <email-id>',
        'resend emails receiving attachments <email-id>',
        'resend emails receiving attachment <email-id> <attachment-id>',
      ],
    }),
  )
  .addCommand(listReceivingCommand, { isDefault: true })
  .addCommand(getReceivingCommand)
  .addCommand(listAttachmentsCommand)
  .addCommand(getAttachmentCommand);
