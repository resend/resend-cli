import { Command, Option } from '@commander-js/extra-typings';
import type { UpdateDomainsOptions } from 'resend';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { pickId } from '../../lib/prompts';
import { domainPickerConfig } from './utils';

export const updateDomainCommand = new Command('update')
  .description(
    'Update domain settings: TLS mode, open tracking, and click tracking',
  )
  .argument('[id]', 'Domain ID')
  .addOption(
    new Option('--tls <mode>', 'TLS mode').choices([
      'opportunistic',
      'enforced',
    ] as const),
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
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, domainPickerConfig, globalOpts);

    const { tls, openTracking, clickTracking } = opts;

    if (!tls && openTracking === undefined && clickTracking === undefined) {
      outputError(
        {
          message:
            'Provide at least one option to update: --tls, --open-tracking, or --click-tracking.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const payload: UpdateDomainsOptions = { id };
    if (tls) {
      payload.tls = tls;
    }
    if (openTracking !== undefined) {
      payload.openTracking = openTracking;
    }
    if (clickTracking !== undefined) {
      payload.clickTracking = clickTracking;
    }

    await runWrite(
      {
        spinner: {
          loading: 'Updating domain...',
          success: 'Domain updated',
          fail: 'Failed to update domain',
        },
        sdkCall: (resend) => resend.domains.update(payload),
        errorCode: 'update_error',
        successMsg: `Domain updated: ${id}`,
      },
      globalOpts,
    );
  });
