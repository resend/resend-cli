import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../../lib/help-text';
import { forgeEnableCommand } from './enable';

export const forgeCommand = new Command('forge')
  .description("Put a domain's sending and receiving on Resend Forge")
  .addHelpText(
    'after',
    buildHelpText({
      context: `Forge lifecycle:
  1. resend domains forge enable <domain-id>        (returns the DNS records)
  2. Add the records at your DNS provider: the Forge CNAME, and the new MX
     record when the domain also receives email
  3. resend domains verify <domain-id> --scope forge (check only the Forge record)
  4. resend domains get <domain-id>                 (poll until the records are "verified")`,
      examples: [
        'resend domains forge enable 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains forge enable 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --custom-return-path forge',
      ],
    }),
  )
  .addCommand(forgeEnableCommand);
