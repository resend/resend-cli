import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Command, Option } from '@commander-js/extra-typings';
import type { CreateContactImportResponseSuccess } from 'resend';
import { runCreate } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { requireText } from '../../../lib/prompts';
import { parseTopicsJson } from '../utils';
import { parseColumnMapJson } from './utils';

export const createContactImportCommand = new Command('create')
  .description('Import contacts in bulk from a local CSV file')
  .option('--file <path>', 'Path to the CSV file to import (required)')
  .option(
    '--column-map <json>',
    'Map CSV columns to contact fields as a JSON object (e.g. \'{"email":"Email","firstName":"First Name"}\')',
  )
  .addOption(
    new Option(
      '--on-conflict <strategy>',
      'How to handle contacts that already exist',
    ).choices(['upsert', 'skip'] as const),
  )
  .option(
    '--segment-id <id...>',
    'Segment ID to add imported contacts to (repeatable: --segment-id abc --segment-id def)',
  )
  .option(
    '--topics <json>',
    'Topic subscriptions as a JSON array of {id, subscription} objects',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --file is required. All other flags are optional.

The CSV file is uploaded as multipart form data (max 100MB).

Column map: pass a JSON object to --column-map that maps CSV column headers to contact
  fields (email, firstName, lastName, unsubscribed, properties). Example:
  '{"email":"Email","firstName":"First Name","properties":{"plan":{"column":"Plan","type":"string"}}}'

On conflict: --on-conflict upsert (default) updates existing contacts; skip leaves them unchanged.

Segments: use --segment-id once per segment to add imported contacts to one or more segments.

Topics: pass a JSON array of {id, subscription} objects (subscription is "opt_in" or "opt_out").`,
      output: `  {"object":"contact_import","id":"<id>"}`,
      errorCodes: [
        'auth_error',
        'missing_file',
        'file_read_error',
        'invalid_column_map',
        'invalid_topics',
        'create_error',
      ],
      examples: [
        'resend contacts imports create --file ./contacts.csv',
        `resend contacts imports create --file ./contacts.csv --column-map '{"email":"Email","firstName":"First Name"}'`,
        'resend contacts imports create --file ./contacts.csv --on-conflict skip --segment-id 78261eea-8f8b-4381-83c6-79fa7120f1cf',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const filePath = await requireText(
      opts.file,
      { message: 'Path to the CSV file', placeholder: './contacts.csv' },
      { message: 'Missing --file flag.', code: 'missing_file' },
      globalOpts,
    );

    let fileContent: Buffer;
    try {
      fileContent = readFileSync(filePath);
    } catch {
      outputError(
        {
          message: `Failed to read file: ${filePath}`,
          code: 'file_read_error',
        },
        { json: globalOpts.json },
      );
    }

    const file = new File([new Uint8Array(fileContent)], basename(filePath), {
      type: 'text/csv',
    });

    const columnMap = parseColumnMapJson(opts.columnMap, globalOpts);
    const segments = (opts.segmentId ?? []).map((id) => ({ id }));
    const topics =
      opts.topics !== undefined
        ? parseTopicsJson(opts.topics, globalOpts)
        : undefined;

    await runCreate<CreateContactImportResponseSuccess>(
      {
        loading: 'Starting contact import...',
        sdkCall: (resend) =>
          resend.contacts.imports.create({
            file,
            ...(columnMap && { columnMap }),
            ...(opts.onConflict && { onConflict: opts.onConflict }),
            ...(segments.length > 0 && { segments }),
            ...(topics && { topics }),
          }),
        onInteractive: (data) => {
          console.log(`Contact import started: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
