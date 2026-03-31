import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { domainPickerConfig } from './utils';

export const verifyDomainCommand = new Command('verify')
  .description('Trigger async DNS verification for a domain')
  .argument('[id]', 'Domain ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Verification is async — the domain enters "pending" status while DNS records are checked.
Poll the status with: resend domains get <id>`,
      output: '  {"object":"domain","id":"<id>"}',
      errorCodes: ['auth_error', 'verify_error'],
      examples: [
        'resend domains verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, domainPickerConfig, globalOpts);

    await runWrite(
      {
        loading: 'Verifying domain...',
        sdkCall: (resend) => resend.domains.verify(id),
        errorCode: 'verify_error',
        successMsg: `Domain verification started. Check status with resend domains get ${id}.`,
      },
      globalOpts,
    );
  });
