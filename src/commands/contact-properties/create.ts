import { Command, Option } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { CreateContactPropertyOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const createContactPropertyCommand = new Command('create')
  .description('Create a new contact property definition')
  .addOption(new Option('--key <key>', 'Property key name, used in broadcast template interpolation (e.g. company_name, department)'))
  .addOption(new Option('--type <type>', "Property data type: 'string' for text values, 'number' for numeric values").choices(['string', 'number'] as const))
  .option('--fallback-value <value>', 'Default value used in broadcast templates when a contact has no value set for this property')
  .addHelpText(
    'after',
    `
Property keys are used as identifiers in broadcast HTML template interpolation:
  {{{PROPERTY_NAME|fallback}}}  — triple-brace syntax substitutes the contact's value
  {{{company_name|Unknown}}}    — falls back to "Unknown" if the property is not set

Reserved keys (cannot be used): FIRST_NAME, LAST_NAME, EMAIL, UNSUBSCRIBE_URL

Non-interactive: --key and --type are required. --fallback-value is optional.
Warning: do not create properties with reserved key names — they will conflict with
built-in contact fields and may cause unexpected behavior in broadcasts.

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"object":"contact_property","id":"<id>"}

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | missing_key | missing_type | invalid_fallback_value | create_error

Examples:
  $ resend contact-properties create --key company_name --type string
  $ resend contact-properties create --key company_name --type string --fallback-value "Unknown"
  $ resend contact-properties create --key employee_count --type number --fallback-value 0
  $ resend contact-properties create --key department --type string --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    let key = opts.key;
    let type = opts.type;

    if (!key) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --key flag.', code: 'missing_key' }, { json: globalOpts.json });
      }
      const result = await p.text({
        message: 'Property key',
        placeholder: 'company_name',
        validate: (v) => (!v ? 'Key is required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      key = result;
    }

    if (!type) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --type flag.', code: 'missing_type' }, { json: globalOpts.json });
      }
      const result = await p.select({
        message: 'Property data type',
        options: [
          { value: 'string' as const, label: 'string — text values' },
          { value: 'number' as const, label: 'number — numeric values' },
        ],
      });
      if (p.isCancel(result)) cancelAndExit('Cancelled.');
      type = result;
    }

    let fallbackValue: string | number | undefined;
    if (opts.fallbackValue !== undefined) {
      if (type === 'number') {
        const parsed = parseFloat(opts.fallbackValue);
        if (isNaN(parsed)) {
          outputError(
            { message: '--fallback-value must be a valid number for number-type properties.', code: 'invalid_fallback_value' },
            { json: globalOpts.json }
          );
        }
        fallbackValue = parsed;
      } else {
        fallbackValue = opts.fallbackValue;
      }
    }

    const spinner = createSpinner('Creating contact property...');

    try {
      const payload = {
        key: key!,
        type: type!,
        ...(fallbackValue !== undefined && { fallbackValue }),
      } as CreateContactPropertyOptions;

      const { data, error } = await resend.contactProperties.create(payload);

      if (error) {
        spinner.fail('Failed to create contact property');
        outputError({ message: error.message, code: 'create_error' }, { json: globalOpts.json });
      }

      spinner.stop('Contact property created');

      if (!globalOpts.json && isInteractive()) {
        console.log(`\nContact property created: ${data!.id}`);
      } else {
        outputResult(data, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to create contact property');
      outputError({ message: errorMessage(err, 'Unknown error'), code: 'create_error' }, { json: globalOpts.json });
    }
  });
