import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { pickId, requireText } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';
import { eventPickerConfig, parseSchemaJson } from './utils';

export const updateEventCommand = new Command('update')
  .description('Update an event schema')
  .argument('[id]', 'Event ID')
  .option(
    '--schema <json>',
    'New schema as JSON (or "null" to clear the schema)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --schema is required. Pass "null" to remove the schema.

Schema format:
  A JSON object mapping field names to type strings.
  Valid types: string, number, boolean, date.
  Example: '{"plan":"string","age":"number"}'`,
      output: '  {"object":"event","id":"<id>"}',
      errorCodes: [
        'auth_error',
        'missing_schema',
        'invalid_schema',
        'update_error',
      ],
      examples: [
        'resend events update <id> --schema \'{"plan":"string","age":"number"}\'',
        'resend events update <id> --schema null',
        'resend events update <id> --schema \'{"plan":"string"}\' --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, eventPickerConfig, globalOpts);

    let schemaRaw = opts.schema;

    if (schemaRaw === undefined) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          {
            message: 'Missing --schema flag.',
            code: 'missing_schema',
          },
          { json: globalOpts.json },
        );
      }
      schemaRaw = await requireText(
        undefined,
        {
          message: 'Schema JSON (or "null" to clear)',
          placeholder: '{"field":"string"}',
        },
        { message: 'Missing --schema flag.', code: 'missing_schema' },
        globalOpts,
      );
    }

    const schema = parseSchemaJson(schemaRaw, globalOpts);

    await runWrite(
      {
        loading: 'Updating event...',
        sdkCall: (resend) => resend.events.update(id, { schema }),
        errorCode: 'update_error',
        successMsg: `Event updated: ${id}`,
      },
      globalOpts,
    );
  });
