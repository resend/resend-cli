import { Command, Option } from '@commander-js/extra-typings';
import type { CreateContactPropertyOptions } from 'resend';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { requireSelect, requireText } from '../../lib/prompts';

export const createContactPropertyCommand = new Command('create')
  .description('Create a new contact property definition')
  .addOption(
    new Option(
      '--key <key>',
      'Property key name, used in broadcast template interpolation (e.g. company_name, department)',
    ),
  )
  .addOption(
    new Option(
      '--type <type>',
      "Property data type: 'string' for text values, 'number' for numeric values",
    ).choices(['string', 'number'] as const),
  )
  .option(
    '--fallback-value <value>',
    'Default value used in broadcast templates when a contact has no value set for this property',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Property keys are used as identifiers in broadcast HTML template interpolation:
  {{{PROPERTY_NAME|fallback}}}  — triple-brace syntax substitutes the contact's value
  {{{company_name|Unknown}}}    — falls back to "Unknown" if the property is not set

Reserved keys (cannot be used): FIRST_NAME, LAST_NAME, EMAIL, UNSUBSCRIBE_URL

Non-interactive: --key and --type are required. --fallback-value is optional.
Warning: do not create properties with reserved key names — they will conflict with
built-in contact fields and may cause unexpected behavior in broadcasts.`,
      output: `  {"object":"contact_property","id":"<id>"}`,
      errorCodes: [
        'auth_error',
        'missing_key',
        'missing_type',
        'invalid_fallback_value',
        'create_error',
      ],
      examples: [
        'resend contact-properties create --key company_name --type string',
        'resend contact-properties create --key company_name --type string --fallback-value "Unknown"',
        'resend contact-properties create --key employee_count --type number --fallback-value 0',
        'resend contact-properties create --key department --type string --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const key = await requireText(
      opts.key,
      { message: 'Property key', placeholder: 'company_name' },
      { message: 'Missing --key flag.', code: 'missing_key' },
      globalOpts,
    );

    const type = await requireSelect(
      opts.type,
      {
        message: 'Property data type',
        options: [
          { value: 'string' as const, label: 'string — text values' },
          { value: 'number' as const, label: 'number — numeric values' },
        ],
      },
      { message: 'Missing --type flag.', code: 'missing_type' },
      globalOpts,
    );

    let fallbackValue: string | number | undefined;
    if (opts.fallbackValue !== undefined) {
      if (type === 'number') {
        const parsed = parseFloat(opts.fallbackValue);
        if (Number.isNaN(parsed)) {
          outputError(
            {
              message:
                '--fallback-value must be a valid number for number-type properties.',
              code: 'invalid_fallback_value',
            },
            { json: globalOpts.json },
          );
        }
        fallbackValue = parsed;
      } else {
        fallbackValue = opts.fallbackValue;
      }
    }

    const payload = {
      key,
      type,
      ...(fallbackValue !== undefined && { fallbackValue }),
    } as CreateContactPropertyOptions;

    await runCreate(
      {
        spinner: {
          loading: 'Creating contact property...',
          success: 'Contact property created',
          fail: 'Failed to create contact property',
        },
        sdkCall: (resend) => resend.contactProperties.create(payload),
        onInteractive: (data) => {
          console.log(`\nContact property created: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
