import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import { parseCsvTable } from '../../lib/parse-csv';
import { requireText } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';
import { tryParsePropertiesJsonObject } from './utils';

const CONCURRENCY = 5;

const CSV_ERROR_MESSAGES: Record<
  'empty' | 'no_data' | 'no_email_column',
  string
> = {
  empty: 'CSV file is empty.',
  no_data: 'No data rows after the header.',
  no_email_column:
    'CSV must include an "email" column (or "e-mail") in the header row.',
};

function parseContactsImportCsv(raw: string): Record<string, string>[] | null {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  if (!text.trim()) {
    return null;
  }

  const table = parseCsvTable(text);
  const headerRow = table[0];
  if (!headerRow) {
    return null;
  }

  const normalize = (h: string): string => {
    const n = h.trim().toLowerCase().replace(/\s+/g, '_');
    if (n === 'e-mail' || n === 'e_mail') {
      return 'email';
    }
    if (n === 'firstname') {
      return 'first_name';
    }
    if (n === 'lastname') {
      return 'last_name';
    }
    return n;
  };

  const headers = headerRow.map(normalize);
  if (!headers.includes('email')) {
    return null;
  }

  const rows: Record<string, string>[] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    if (!cells || cells.every((c) => c.trim() === '')) {
      continue;
    }

    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (key) {
        row[key] = cells[c]?.trim() ?? '';
      }
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return null;
  }
  return rows;
}

export const importContactsCommand = new Command('import')
  .description('Create contacts from a CSV file')
  .option(
    '--file <path>',
    'Path to CSV (header row required; "-" for stdin in non-interactive mode)',
  )
  .option(
    '--segment-id <id...>',
    'Segment ID to add each imported contact to on creation (repeatable)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `The first row must be column headers. Required column: email (or e-mail).

Optional columns: first_name, last_name, properties (JSON object per cell).

Processing: up to ${CONCURRENCY} rows are imported concurrently. Failed rows are collected and reported at the end. Exit code 1 if any rows fail.`,
      errorCodes: [
        'auth_error',
        'missing_file',
        'file_read_error',
        'stdin_read_error',
        'invalid_csv',
        'import_error',
      ],
      examples: [
        'resend contacts import --file ./users.csv --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        'resend contacts import --file ./users.csv',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const filePath = await requireText(
      opts.file,
      { message: 'Path to CSV file', placeholder: './contacts.csv' },
      { message: 'Missing --file flag.', code: 'missing_file' },
      globalOpts,
    );

    const rows = parseContactsImportCsv(readFile(filePath, globalOpts));
    if (!rows) {
      outputError(
        { message: CSV_ERROR_MESSAGES.no_email_column, code: 'invalid_csv' },
        { json: globalOpts.json },
      );
    }

    const resend = await requireClient(globalOpts);
    const segments = opts.segmentId ?? [];
    const spinner = createSpinner(
      `Importing ${rows.length} contacts...`,
      globalOpts.quiet,
    );

    const imported: { row: number; id: string; email: string }[] = [];
    const errors: { row: number; email?: string; message: string }[] = [];

    // Process in chunks for concurrency
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (row, idx) => {
          const rowNum = i + idx + 2;
          const email = row.email?.trim();
          if (!email) {
            errors.push({ row: rowNum, message: 'Missing email' });
            return;
          }

          let properties: Record<string, string | number | null> | undefined;
          if (row.properties) {
            const parsed = tryParsePropertiesJsonObject(row.properties);
            if (!parsed) {
              errors.push({
                row: rowNum,
                email,
                message: 'Invalid properties JSON',
              });
              return;
            }
            properties = parsed;
          }

          const { data, error } = await resend.contacts.create({
            email,
            ...(row.first_name && { firstName: row.first_name }),
            ...(row.last_name && { lastName: row.last_name }),
            ...(properties && { properties }),
            ...(segments.length > 0 && {
              segments: segments.map((id) => ({ id })),
            }),
          });

          if (error || !data) {
            errors.push({
              row: rowNum,
              email,
              message: error?.message ?? 'Failed',
            });
          } else {
            imported.push({ row: rowNum, id: data.id, email });
          }
        }),
      );
    }

    spinner.stop();

    if (imported.length === 0) {
      outputError(
        {
          message: `No contacts imported (${errors.length} failed).`,
          code: 'import_error',
        },
        { json: globalOpts.json },
      );
    }

    if (errors.length > 0) {
      process.exitCode = 1;
    }

    if (!globalOpts.json && isInteractive()) {
      console.log(
        `Imported ${imported.length} contact${imported.length === 1 ? '' : 's'}`,
      );
      for (const c of imported) {
        console.log(`  ${c.email}  ${c.id}`);
      }
      if (errors.length > 0) {
        console.warn(`\n${errors.length} failed:`);
        for (const e of errors) {
          console.warn(
            `  [row ${e.row}${e.email ? ` ${e.email}` : ''}] ${e.message}`,
          );
        }
      }
    } else {
      outputResult(errors.length > 0 ? { data: imported, errors } : imported, {
        json: globalOpts.json,
      });
    }
  });
