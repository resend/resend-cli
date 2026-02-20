import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const verifyDomainCommand = new Command('verify')
  .description('Trigger async DNS verification for a domain')
  .argument('<id>', 'Domain ID')
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
    })
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    const data = await withSpinner(
      { loading: 'Verifying domain...', success: 'Verification started', fail: 'Failed to verify domain' },
      () => resend.domains.verify(id),
      'verify_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`Domain verification started. Check status with resend domains get ${id}.`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
