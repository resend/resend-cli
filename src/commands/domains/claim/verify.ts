import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { domainPickerConfig } from '../utils';

export const claimVerifyCommand = new Command('verify')
  .description('Trigger DNS verification and transfer for a domain claim')
  .argument('[id]', 'Domain ID (the placeholder domain created by the claim)')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  domain_claim object (status stays pending while verification runs async).',
      errorCodes: ['auth_error', 'verify_error', 'not_found'],
      examples: [
        'resend domains claim verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, domainPickerConfig, globalOpts);
    await runWrite(
      {
        loading: 'Verifying domain claim...',
        sdkCall: (resend) => resend.domains.claims.verify(id),
        errorCode: 'verify_error',
        successMsg: `Domain claim verification started. Check status with resend domains claim get ${id}.`,
      },
      globalOpts,
    );
  });
