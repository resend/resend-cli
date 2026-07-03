import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { confirmDelete, pickItem } from '../../lib/prompts';
import { oauthGrantPickerConfig } from './utils';

export const revokeOAuthGrantCommand = new Command('revoke')
  .description(
    'Revoke an OAuth grant — every access and refresh token issued under it stops working immediately',
  )
  .argument('[id]', 'OAuth grant ID')
  .option('--yes', 'Skip confirmation prompt')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --yes is required to confirm revocation when stdin/stdout is not a TTY.

Any team API key can revoke any of the team's grants. Revocation is immediate and
irreversible — the client would need to re-authorize to regain access.`,
      output: `  {"object":"oauth_grant","id":"<id>","revoked_at":"<date>","revoked_reason":"<reason>"}`,
      errorCodes: ['auth_error', 'confirmation_required', 'revoke_error'],
      examples: [
        'resend oauth-grants revoke 650e8400-e29b-41d4-a716-446655440001 --yes',
        'resend oauth-grants revoke 650e8400-e29b-41d4-a716-446655440001 --yes --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const picked = await pickItem(idArg, oauthGrantPickerConfig, globalOpts);
    if (!opts.yes) {
      await confirmDelete(
        picked.id,
        `Revoke OAuth grant for "${picked.label}"?\nID: ${picked.id}\nEvery access and refresh token issued under it will stop working.`,
        globalOpts,
      );
    }
    await runWrite(
      {
        loading: 'Revoking OAuth grant...',
        sdkCall: (resend) => resend.oauthGrants.revoke(picked.id),
        errorCode: 'revoke_error',
        successMsg: 'OAuth grant revoked',
      },
      globalOpts,
    );
  });
