import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';

export const updateContactPropertyCommand = new Command('update')
  .description('Update a contact property definition')
  .argument('<id>', 'Contact property UUID')
  .option('--fallback-value <value>', 'New fallback value used in broadcast templates when a contact has no value set for this property')
  .option('--clear-fallback-value', 'Remove the fallback value (sets it to null)')
  .addHelpText(
    'after',
    `
Note: the property key and type cannot be changed after creation. Only the fallback value
is updatable. Renaming a property would break existing broadcasts that reference the old key.

--fallback-value and --clear-fallback-value are mutually exclusive.

The fallback value is used in broadcast template interpolation when a contact has no value:
  {{{company_name|Unknown}}}  — inline fallback (takes precedence over the property's fallback)
  {{{company_name}}}          — uses the property's stored fallback value if set

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"contact_property","id":"<id>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | conflicting_flags | update_error

Examples:
  $ resend contact-properties update prop_abc123 --fallback-value "Acme Corp"
  $ resend contact-properties update prop_abc123 --fallback-value 42
  $ resend contact-properties update prop_abc123 --clear-fallback-value
  $ resend contact-properties update prop_abc123 --fallback-value "Unknown" --json`
  )
  .action(async (id, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    if (opts.fallbackValue !== undefined && opts.clearFallbackValue) {
      outputError(
        { message: '--fallback-value and --clear-fallback-value are mutually exclusive.', code: 'conflicting_flags' },
        { json: globalOpts.json }
      );
    }

    const spinner = createSpinner('Updating contact property...');

    try {
      const fallbackValue = opts.clearFallbackValue ? null : opts.fallbackValue;

      const { data, error } = await resend.contactProperties.update({
        id,
        ...(fallbackValue !== undefined && { fallbackValue }),
      });

      if (error) {
        spinner.fail('Failed to update contact property');
        outputError({ message: error.message, code: 'update_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact property updated');
      outputResult(data, { json: globalOpts.json });
    } catch (err) {
      spinner.fail('Failed to update contact property');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'update_error' }, { json: globalOpts.json });
    }
  });
