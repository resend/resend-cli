import { Command, Option } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { domainPickerConfig } from './utils';

export const verifyDomainCommand = new Command('verify')
  .description('Trigger async DNS verification for a domain')
  .argument('[id]', 'Domain ID')
  .addOption(
    new Option(
      '--scope <scope>',
      'Check only these records. forge checks only the Forge record; the other records keep their current status.',
    ).choices(['forge'] as const),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Verification is async — the domain enters "pending" status while DNS records are checked.
Poll the status with: resend domains get <id>
--scope forge requires Forge to be enabled on the domain (see: resend domains forge enable).`,
      output: '  {"object":"domain","id":"<id>"}',
      errorCodes: ['auth_error', 'verify_error'],
      examples: [
        'resend domains verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --scope forge',
        'resend domains verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, domainPickerConfig, globalOpts);

    await runWrite(
      {
        loading: 'Verifying domain...',
        sdkCall: (resend) =>
          opts.scope
            ? resend.domains.verify(id, { scope: [opts.scope] })
            : resend.domains.verify(id),
        errorCode: 'verify_error',
        successMsg: `Domain verification started. Check status with resend domains get ${id}.`,
      },
      globalOpts,
    );
  });
