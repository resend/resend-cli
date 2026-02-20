import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
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

    const spinner = createSpinner('Verifying domain...');

    try {
      const { data, error } = await resend.domains.verify(id);

      if (error) {
        spinner.fail('Failed to verify domain');
        outputError({ message: error.message, code: 'verify_error' }, { json: globalOpts.json });
      }

      spinner.stop('Verification started');

      if (!globalOpts.json && isInteractive()) {
        console.log(`Domain verification started. Check status with resend domains get ${id}.`);
      } else {
        outputResult(data!, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to verify domain');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'verify_error' },
        { json: globalOpts.json }
      );
    }
  });
