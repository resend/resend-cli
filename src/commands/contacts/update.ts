import { Command } from '@commander-js/extra-typings';
import type { UpdateContactOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { withSpinner } from '../../lib/spinner';
import { outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import { buildHelpText } from '../../lib/help-text';
import { contactIdentifier, parsePropertiesJson } from './utils';

export const updateContactCommand = new Command('update')
  .description("Update a contact's subscription status or custom properties")
  .argument('<id>', 'Contact UUID or email address — both are accepted by the API')
  .option('--unsubscribed', 'Globally unsubscribe the contact from all broadcasts')
  .option('--no-unsubscribed', 'Re-subscribe the contact (clears the global unsubscribe flag)')
  .option('--properties <json>', "JSON object of properties to merge (e.g. '{\"company\":\"Acme\"}'); set a key to null to clear it")
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
        'resend contacts update 479e3145-dd38-4932-8c0c-e58b548c9e76 --unsubscribed',
        'resend contacts update user@example.com --no-unsubscribed',
        `resend contacts update 479e3145-dd38-4932-8c0c-e58b548c9e76 --properties '{"plan":"pro"}'`,
        'resend contacts update user@example.com --unsubscribed --json',
      ],
    }),
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const properties = parsePropertiesJson(opts.properties, globalOpts);

    // contactIdentifier resolves UUID vs email. The spread of a discriminated
    // union requires an explicit cast because TypeScript cannot narrow it
    // through a spread at the call site.
    const payload = {
      ...contactIdentifier(id),
      ...(opts.unsubscribed !== undefined && { unsubscribed: opts.unsubscribed }),
      ...(properties && { properties }),
    } as UpdateContactOptions;

    const data = await withSpinner(
      { loading: 'Updating contact...', success: 'Contact updated', fail: 'Failed to update contact' },
      () => resend.contacts.update(payload),
      'update_error',
      globalOpts,
    );

    if (!globalOpts.json && isInteractive()) {
      console.log(`Contact updated: ${id}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
