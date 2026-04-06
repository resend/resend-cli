import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { requireText } from '../../lib/prompts';
import { parseSchemaJson } from './utils';

export const createEventCommand = new Command('create')
  .description('Create a new event definition')
  .option('--name <name>', 'Event name (e.g. user.signed_up)')
  .option(
    '--schema <json>',
    'Schema as JSON mapping field names to types (string | number | boolean | date)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --name is required. --schema is optional.

Schema format:
  A JSON object mapping field names to type strings.
  Valid types: string, number, boolean, date.
  Example: '{"plan":"string","age":"number","active":"boolean"}'`,
      output: '  {"object":"event","id":"<id>"}',
      errorCodes: [
        'auth_error',
        'missing_name',
        'invalid_schema',
        'create_error',
      ],
      examples: [
        'resend events create --name "user.signed_up"',
        'resend events create --name "order.completed" --schema \'{"amount":"number","currency":"string"}\'',
        'resend events create --name "user.signed_up" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const name = await requireText(
      opts.name,
      { message: 'Event name', placeholder: 'e.g. user.signed_up' },
      { message: 'Missing --name flag.', code: 'missing_name' },
      globalOpts,
    );

    const schema = opts.schema
      ? parseSchemaJson(opts.schema, globalOpts)
      : undefined;

    await runCreate(
      {
        loading: 'Creating event...',
        sdkCall: (resend) => {
          const payload: Parameters<typeof resend.events.create>[0] = { name };
          if (schema !== undefined) {
            payload.schema = schema;
          }
          return resend.events.create(payload);
        },
        onInteractive: (d) => {
          console.log(`Event created: ${d.id}`);
        },
      },
      globalOpts,
    );
  });
