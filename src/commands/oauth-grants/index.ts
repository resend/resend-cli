import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { listOAuthGrantsCommand } from './list';
import { revokeOAuthGrantCommand } from './revoke';

export const oauthGrantsCommand = new Command('oauth-grants')
  .description('Manage OAuth grants (apps authorized to act on the team)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `An OAuth grant is a durable record of a client (app) authorized by the team.
  - Listing returns every grant, active and revoked. revoked_at/revoked_reason are null while active.
  - Revoking is immediate: all access and refresh tokens issued under the grant stop working.`,
      examples: [
        'resend oauth-grants list',
        'resend oauth-grants list --limit 25 --json',
        'resend oauth-grants revoke <id> --yes',
      ],
    }),
  )
  .addCommand(listOAuthGrantsCommand, { isDefault: true })
  .addCommand(revokeOAuthGrantCommand);
