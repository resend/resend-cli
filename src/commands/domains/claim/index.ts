import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { claimCreateCommand } from './create';
import { claimGetCommand } from './get';
import { claimVerifyCommand } from './verify';

export const claimCommand = new Command('claim')
  .description('Claim a domain already verified by another Resend account')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Claim lifecycle:
  1. resend domains claim create --name example.com   (returns the TXT record)
  2. Configure the TXT record at your DNS provider
  3. resend domains claim verify <domain-id>           (trigger verification + transfer)
  4. resend domains claim get <domain-id>              (poll until "completed")
  5. The transferred domain has NEW DKIM records — update DNS, then run:
     resend domains verify <domain-id>`,
      examples: [
        'resend domains claim create --name example.com',
        'resend domains claim get 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains claim verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
      ],
    }),
  )
  .addCommand(claimCreateCommand)
  .addCommand(claimGetCommand)
  .addCommand(claimVerifyCommand);
