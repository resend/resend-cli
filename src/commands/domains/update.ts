import { Command, Option } from '@commander-js/extra-typings';
import type { UpdateDomainsOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';

export const updateDomainCommand = new Command('update')
  .description('Update domain settings: TLS mode, open tracking, and click tracking')
  .argument('<id>', 'Domain ID')
  .addOption(
    new Option('--tls <mode>', 'TLS mode').choices(['opportunistic', 'enforced'] as const)
  )
  .option('--open-tracking', 'Enable open tracking')
  .option('--no-open-tracking', 'Disable open tracking')
  .option('--click-tracking', 'Enable click tracking')
  .option('--no-click-tracking', 'Disable click tracking')
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"domain","id":"<id>"}',
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend domains update <id> --tls enforced',
        'resend domains update <id> --open-tracking --click-tracking',
        'resend domains update <id> --no-open-tracking --json',
      ],
    })
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    const { tls, openTracking, clickTracking } = opts;

    if (!tls && openTracking === undefined && clickTracking === undefined) {
      outputError(
        {
          message: 'Provide at least one option to update: --tls, --open-tracking, or --click-tracking.',
          code: 'no_changes',
        },
        { json: globalOpts.json }
      );
    }

    const payload: UpdateDomainsOptions = { id };
    if (tls) payload.tls = tls;
    if (openTracking !== undefined) payload.openTracking = openTracking;
    if (clickTracking !== undefined) payload.clickTracking = clickTracking;

    const spinner = createSpinner('Updating domain...');

    try {
      const { data, error } = await resend.domains.update(payload);

      if (error) {
        spinner.fail('Failed to update domain');
        outputError({ message: error.message, code: 'update_error' }, { json: globalOpts.json });
      }

      spinner.stop('Domain updated');
      if (!globalOpts.json && isInteractive()) {
        console.log(`Domain updated: ${id}`);
      } else {
        outputResult(data!, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to update domain');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'update_error' },
        { json: globalOpts.json }
      );
    }
  });
