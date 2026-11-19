import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { domainPickerConfig, renderDnsRecordsTable } from '../utils';

export const forgeEnableCommand = new Command('enable')
  .description('Put a domain on Resend Forge and return the DNS records to add')
  .argument('[id]', 'Domain ID')
  .option(
    '--custom-return-path <subdomain>',
    'Subdomain for the Forge Return-Path address (e.g. forge). Set once, it cannot be changed afterwards.',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `When --custom-return-path is omitted, Resend picks a subdomain that is free in your DNS.
Calling it again on a domain already on Forge returns its current state.`,
      output: '  Full domain object, with the Forge record in "records".',
      errorCodes: ['auth_error', 'create_error'],
      examples: [
        'resend domains forge enable 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend domains forge enable 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --custom-return-path forge',
        'resend domains forge enable 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, domainPickerConfig, globalOpts);

    await runCreate(
      {
        loading: 'Enabling Forge...',
        sdkCall: (resend) =>
          resend.domains.forge.enable({
            id,
            ...(opts.customReturnPath !== undefined && {
              customReturnPath: opts.customReturnPath,
            }),
          }),
        onInteractive: (d) => {
          console.log(`Forge enabled for ${d.name} (id: ${d.id})`);
          console.log('\nDNS Records to configure:');
          console.log(renderDnsRecordsTable(d.records, d.name));
          console.log(
            `\nAfter you add them, run \`resend domains verify ${d.id} --scope forge\`.`,
          );
        },
      },
      globalOpts,
    );
  });
