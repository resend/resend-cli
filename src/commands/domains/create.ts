import { Command, Option } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { renderDnsRecordsTable } from './utils';

export const createDomainCommand = new Command('create')
  .description('Create a new domain and receive DNS records to configure')
  .option('--name <domain>', 'Domain name (e.g. example.com)')
  .addOption(
    new Option('--region <region>', 'Sending region').choices([
      'us-east-1',
      'eu-west-1',
      'sa-east-1',
      'ap-northeast-1',
    ] as const)
  )
  .addOption(
    new Option('--tls <mode>', 'TLS mode (default: opportunistic)').choices([
      'opportunistic',
      'enforced',
    ] as const)
  )
  .option('--sending', 'Enable sending capability (default: enabled)')
  .option('--receiving', 'Enable receiving capability (default: disabled)')
  .addHelpText(
    'after',
    `
Non-interactive: --name is required (no prompts when stdin/stdout is not a TTY)

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  Full domain object with DNS records array to configure in your DNS provider.

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | missing_name | create_error

Examples:
  $ resend domains create --name example.com
  $ resend domains create --name example.com --region eu-west-1 --tls enforced
  $ resend domains create --name example.com --receiving --json
  $ resend domains create --name example.com --sending --receiving --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    let name = opts.name;

    if (!name) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --name flag.', code: 'missing_name' }, { json: globalOpts.json });
      }

      const result = await p.text({
        message: 'Domain name',
        placeholder: 'example.com',
        validate: (v) => (!v ? 'Domain name is required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      name = result;
    }

    const spinner = createSpinner('Creating domain...');

    try {
      const { data, error } = await resend.domains.create({
        name,
        ...(opts.region && { region: opts.region }),
        ...(opts.tls && { tls: opts.tls }),
        ...((opts.sending || opts.receiving) && {
          capabilities: {
            ...(opts.sending && { sending: 'enabled' as const }),
            ...(opts.receiving && { receiving: 'enabled' as const }),
          },
        }),
      });

      if (error) {
        spinner.fail('Failed to create domain');
        outputError({ message: error.message, code: 'create_error' }, { json: globalOpts.json });
      }

      spinner.stop('Domain created');

      const d = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(`\nDomain created: ${d.name} (id: ${d.id})`);
        console.log('\nDNS Records to configure:');
        console.log(renderDnsRecordsTable(d.records, d.name));
        console.log(`\nRun \`resend domains verify ${d.id}\` after configuring DNS.`);
      } else {
        outputResult(d, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to create domain');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'create_error' },
        { json: globalOpts.json }
      );
    }
  });
