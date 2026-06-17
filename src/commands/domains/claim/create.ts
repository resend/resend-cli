import { Command, Option } from '@commander-js/extra-typings';
import { runCreate } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { requireText } from '../../../lib/prompts';

export const claimCreateCommand = new Command('create')
  .description('Start a claim for a domain another Resend account has verified')
  .option('--name <domain>', 'Domain name to claim (e.g. example.com)')
  .addOption(
    new Option('--region <region>', 'Sending region').choices([
      'us-east-1',
      'eu-west-1',
      'sa-east-1',
      'ap-northeast-1',
    ] as const),
  )
  .option(
    '--tracking-subdomain <subdomain>',
    'Subdomain for click and open tracking (e.g. track)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Non-interactive: --name is required (no prompts when stdin/stdout is not a TTY)',
      output:
        '  domain_claim object with the placeholder domain_id and the TXT record to add to DNS.',
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend domains claim create --name example.com',
        'resend domains claim create --name example.com --region eu-west-1',
        'resend domains claim create --name example.com --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const name = await requireText(
      opts.name,
      { message: 'Domain name to claim', placeholder: 'example.com' },
      { message: 'Missing --name flag.', code: 'missing_name' },
      globalOpts,
    );

    await runCreate(
      {
        loading: 'Starting domain claim...',
        sdkCall: (resend) =>
          resend.domains.claims.create({
            name,
            ...(opts.region && { region: opts.region }),
            ...(opts.trackingSubdomain !== undefined && {
              trackingSubdomain: opts.trackingSubdomain,
            }),
          }),
        onInteractive: (c) => {
          console.log(
            `Claim started for ${c.name} (claim id: ${c.id}, domain id: ${c.domain_id})`,
          );
          console.log(`Status: ${c.status}`);
          console.log('\nAdd this TXT record at your DNS provider:');
          console.log(`  ${c.record.name}  TXT  ${c.record.value}`);
          console.log(
            `\nThen run \`resend domains claim verify ${c.domain_id}\`.`,
          );
        },
      },
      globalOpts,
    );
  });
