import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { pickId } from '../../lib/prompts';
import { contactPropertyPickerConfig } from './utils';

export const updateContactPropertyCommand = new Command('update')
  .description('Update a contact property definition')
  .argument('[id]', 'Contact property UUID')
  .option(
    '--fallback-value <value>',
    'New fallback value used in broadcast templates when a contact has no value set for this property',
  )
  .option(
    '--clear-fallback-value',
    'Remove the fallback value (sets it to null)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Note: the property key and type cannot be changed after creation. Only the fallback value
is updatable. Renaming a property would break existing broadcasts that reference the old key.

--fallback-value and --clear-fallback-value are mutually exclusive.

The fallback value is used in broadcast template interpolation when a contact has no value:
  {{{company_name|Unknown}}}  — inline fallback (takes precedence over the property's fallback)
  {{{company_name}}}          — uses the property's stored fallback value if set`,
      output: `  {"object":"contact_property","id":"<id>"}`,
      errorCodes: [
        'auth_error',
        'no_changes',
        'conflicting_flags',
        'update_error',
      ],
      examples: [
        'resend contact-properties update b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d --fallback-value "Acme Corp"',
        'resend contact-properties update b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d --fallback-value 42',
        'resend contact-properties update b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d --clear-fallback-value',
        'resend contact-properties update b4a3c2d1-6e5f-8a7b-0c9d-2e1f4a3b6c5d --fallback-value "Unknown" --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, contactPropertyPickerConfig, globalOpts);

    if (opts.fallbackValue === undefined && !opts.clearFallbackValue) {
      outputError(
        {
          message:
            'Provide at least one option to update: --fallback-value or --clear-fallback-value.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    if (opts.fallbackValue !== undefined && opts.clearFallbackValue) {
      outputError(
        {
          message:
            '--fallback-value and --clear-fallback-value are mutually exclusive.',
          code: 'conflicting_flags',
        },
        { json: globalOpts.json },
      );
    }

    const fallbackValue = opts.clearFallbackValue ? null : opts.fallbackValue;

    await runWrite(
      {
        spinner: {
          loading: 'Updating contact property...',
          success: 'Contact property updated',
          fail: 'Failed to update contact property',
        },
        sdkCall: (resend) =>
          resend.contactProperties.update({
            id,
            ...(fallbackValue !== undefined && { fallbackValue }),
          }),
        errorCode: 'update_error',
        successMsg: `Contact property updated: ${id}`,
      },
      globalOpts,
    );
  });
