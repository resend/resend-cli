import { Command, Option } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { requireText } from '../../lib/prompts';
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
    ] as const),
  )
  .addOption(
    new Option('--tls <mode>', 'TLS mode (default: opportunistic)').choices([
      'opportunistic',
      'enforced',
    ] as const),
  )
  .option('--sending', 'Enable sending capability (default: enabled)')
  .option('--receiving', 'Enable receiving capability (default: disabled)')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Non-interactive: --name is required (no prompts when stdin/stdout is not a TTY)',
      output:
        '  Full domain object with DNS records array to configure in your DNS provider.',
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend domains create --name example.com',
        'resend domains create --name example.com --region eu-west-1 --tls enforced',
        'resend domains create --name example.com --receiving --json',
        'resend domains create --name example.com --sending --receiving --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const name = await requireText(
      opts.name,
      { message: 'Domain name', placeholder: 'example.com' },
      { message: 'Missing --name flag.', code: 'missing_name' },
      globalOpts,
    );

    await runCreate(
      {
        loading: 'Creating domain...',
        sdkCall: (resend) =>
          resend.domains.create({
            name,
            ...(opts.region && { region: opts.region }),
            ...(opts.tls && { tls: opts.tls }),
            ...((opts.sending || opts.receiving) && {
              capabilities: {
                ...(opts.sending && { sending: 'enabled' as const }),
                ...(opts.receiving && { receiving: 'enabled' as const }),
              },
            }),
          }),
        onInteractive: (d) => {
          console.log(`Domain created: ${d.name} (id: ${d.id})`);
          console.log('\nDNS Records to configure:');
          console.log(renderDnsRecordsTable(d.records, d.name));
          console.log(
            `\nRun \`resend domains verify ${d.id}\` after configuring DNS.`,
          );
        },
      },
      globalOpts,
    );
  });
