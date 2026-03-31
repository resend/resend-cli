import { Command } from '@commander-js/extra-typings';
import type { UpdateContactOptions } from 'resend';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import {
  contactIdentifier,
  contactPickerConfig,
  parsePropertiesJson,
} from './utils';

export const updateContactCommand = new Command('update')
  .description("Update a contact's subscription status or custom properties")
  .argument(
    '[id]',
    'Contact UUID or email address — both are accepted by the API',
  )
  .option(
    '--unsubscribed',
    'Globally unsubscribe the contact from all broadcasts',
  )
  .option(
    '--no-unsubscribed',
    'Re-subscribe the contact (clears the global unsubscribe flag)',
  )
  .option(
    '--properties <json>',
    'JSON object of properties to merge (e.g. \'{"company":"Acme"}\'); set a key to null to clear it',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `The <id> argument accepts either a UUID or an email address.

Subscription toggle:
  --unsubscribed   Sets unsubscribed: true  — contact will not receive any broadcasts.
  --no-unsubscribed Sets unsubscribed: false — re-enables broadcast delivery.
  Omitting both flags leaves the subscription status unchanged.

Properties: --properties merges the given JSON object with existing properties.
  Set a key to null to clear it: '{"company":null}'.`,
      output: `  {"object":"contact","id":"<id>"}`,
      errorCodes: ['auth_error', 'invalid_properties', 'update_error'],
      examples: [
        'resend contacts update e169aa45-1ecf-4183-9955-b1499d5701d3 --unsubscribed',
        'resend contacts update acme@example.com --no-unsubscribed',
        `resend contacts update e169aa45-1ecf-4183-9955-b1499d5701d3 --properties '{"plan":"pro"}'`,
        'resend contacts update acme@example.com --unsubscribed --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPickerConfig, globalOpts);

    const properties = parsePropertiesJson(opts.properties, globalOpts);

    // contactIdentifier resolves UUID vs email. The spread of a discriminated
    // union requires an explicit cast because TypeScript cannot narrow it
    // through a spread at the call site.
    const payload = {
      ...contactIdentifier(id),
      ...(opts.unsubscribed !== undefined && {
        unsubscribed: opts.unsubscribed,
      }),
      ...(properties && { properties }),
    } as UpdateContactOptions;

    await runWrite(
      {
        loading: 'Updating contact...',
        sdkCall: (resend) => resend.contacts.update(payload),
        errorCode: 'update_error',
        successMsg: `Contact updated: ${id}`,
      },
      globalOpts,
    );
  });
