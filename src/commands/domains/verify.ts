import { Command } from '@commander-js/extra-typings';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const verifyDomainCommand = new Command('verify')
  .description('Trigger async DNS verification for a domain')
  .argument('<id>', 'Domain ID')
  .addHelpText(
    'after',
    `
Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"domain","id":"<id>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | verify_error

Notes:
  Verification is async. The domain enters "pending" status while DNS records are checked.
  Poll status with: resend domains get <id>

Examples:
  $ resend domains verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0
  $ resend domains verify 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json`
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as { apiKey?: string; json?: boolean };

    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Verifying domain...', 'braille');

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
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to verify domain');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'verify_error' },
        { json: globalOpts.json }
      );
    }
  });
