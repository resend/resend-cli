import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { renderDnsRecordsTable, statusIndicator } from './utils';

export const getDomainCommand = new Command('get')
  .description('Retrieve a domain with its DNS records and current verification status')
  .argument('<id>', 'Domain ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: 'Domain status values: not_started | pending | verified | failed | temporary_failure',
      output: '  Full domain object including records array and current status.',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend domains get 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains get 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json',
      ],
    })
  )
  .action(async (id, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    const spinner = createSpinner('Fetching domain...');

    try {
      const { data, error } = await resend.domains.get(id);

      if (error) {
        spinner.fail('Failed to fetch domain');
        outputError({ message: error.message, code: 'fetch_error' }, { json: globalOpts.json });
      }

      spinner.stop('Domain fetched');

      const d = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log(`\n${d.name} — ${statusIndicator(d.status)}`);
        console.log(`ID: ${d.id}`);
        console.log(`Region: ${d.region}`);
        console.log(`Created: ${d.created_at}`);
        if (d.records.length > 0) {
          console.log('\nDNS Records:');
          console.log(renderDnsRecordsTable(d.records, d.name));
        }
      } else {
        outputResult(d, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to fetch domain');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'fetch_error' },
        { json: globalOpts.json }
      );
    }
  });
