import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createDomainCommand } from './create';
import { deleteDomainCommand } from './delete';
import { getDomainCommand } from './get';
import { listDomainsCommand } from './list';
import { updateDomainCommand } from './update';
import { verifyDomainCommand } from './verify';

export const domainsCommand = new Command('domains')
  .description('Manage verified sending and receiving domains')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Domain lifecycle:
  1. resend domains create --name example.com    (get DNS records)
  2. Configure DNS records at your DNS provider
  3. resend domains verify <id>                  (trigger verification)
  4. resend domains get <id>                     (poll until "verified")`,
      examples: [
        'resend domains list',
        'resend domains create --name example.com --region us-east-1',
        'resend domains verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains get 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains update <id> --tls enforced --open-tracking',
        'resend domains delete <id> --yes',
      ],
    }),
  )
  .addCommand(createDomainCommand)
  .addCommand(verifyDomainCommand)
  .addCommand(getDomainCommand)
  .addCommand(listDomainsCommand, { isDefault: true })
  .addCommand(updateDomainCommand)
  .addCommand(deleteDomainCommand);
