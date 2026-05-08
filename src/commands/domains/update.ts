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
    'Update domain settings: TLS mode, tracking, and tracking subdomain',
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
  .option(
    '--tracking-subdomain <subdomain>',
    'Subdomain for click and open tracking (e.g. track)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"domain","id":"<id>"}',
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend domains update <id> --tls enforced',
        'resend domains update <id> --open-tracking --click-tracking',
        'resend domains update <id> --tracking-subdomain track',
        'resend domains update <id> --no-open-tracking --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, domainPickerConfig, globalOpts);

    const { tls, openTracking, clickTracking, trackingSubdomain } = opts;

    if (
      !tls &&
      openTracking === undefined &&
      clickTracking === undefined &&
      !trackingSubdomain
    ) {
      outputError(
        {
          message:
            'Provide at least one option to update: --tls, --open-tracking, --click-tracking, or --tracking-subdomain.',
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
    if (trackingSubdomain) {
      payload.trackingSubdomain = trackingSubdomain;
    }

    await runWrite(
      {
        loading: 'Updating domain...',
        sdkCall: (resend) => resend.domains.update(payload),
        errorCode: 'update_error',
        successMsg: `Domain updated: ${id}`,
      },
      globalOpts,
    );
  });
