import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import {
  domainPickerConfig,
  renderDnsRecordsTable,
  statusIndicator,
} from './utils';

export const getDomainCommand = new Command('get')
  .description(
    'Retrieve a domain with its DNS records and current verification status',
  )
  .argument('[id]', 'Domain ID')
  .addHelpText(
    'after',
    buildHelpText({
      output:
        '  Full domain object including records array and current status.\n\nDomain status values: not_started | pending | verified | failed | temporary_failure',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend domains get 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains get 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, domainPickerConfig, globalOpts);
    await runGet(
      {
        spinner: {
          loading: 'Fetching domain...',
          success: 'Domain fetched',
          fail: 'Failed to fetch domain',
        },
        sdkCall: (resend) => resend.domains.get(id),
        onInteractive: (d) => {
          console.log(`\n${d.name} — ${statusIndicator(d.status)}`);
          console.log(`ID: ${d.id}`);
          console.log(`Region: ${d.region}`);
          console.log(`Created: ${d.created_at}`);
          if (d.records.length > 0) {
            console.log('\nDNS Records:');
            console.log(renderDnsRecordsTable(d.records, d.name));
          }
        },
      },
      globalOpts,
    );
  });
