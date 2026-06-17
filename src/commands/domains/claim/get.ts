import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { domainPickerConfig } from '../utils';

export const claimGetCommand = new Command('get')
  .description('Retrieve the latest claim for a domain')
  .argument('[id]', 'Domain ID (the placeholder domain created by the claim)')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  domain_claim object: status, domain_id, the TXT record, blocked_reason, expires_at.\n\nClaim status values: pending | verified | completed | blocked | expired | superseded | canceled | failed',
      errorCodes: ['auth_error', 'fetch_error', 'not_found'],
      examples: [
        'resend domains claim get 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains claim get 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, domainPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching domain claim...',
        sdkCall: (resend) => resend.domains.claims.get(id),
        onInteractive: (c) => {
          console.log(`${c.name} — ${c.status}`);
          console.log(`Claim ID: ${c.id}`);
          console.log(`Domain ID: ${c.domain_id}`);
          if (c.blocked_reason) {
            console.log(`Blocked: ${c.blocked_reason}`);
          }
          console.log(`Expires: ${c.expires_at}`);
          console.log('\nTXT record:');
          console.log(`  ${c.record.name}  TXT  ${c.record.value}`);
        },
      },
      globalOpts,
    );
  });
