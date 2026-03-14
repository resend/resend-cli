import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { AddContactSegmentOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { parseCsv } from '../../lib/csv';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import { cancelAndExit, requireText } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';
import { segmentContactIdentifier } from './utils';

export const migrateContactsCommand = new Command('migrate')
  .description(
    'Bulk-migrate contacts between segments using a CSV or JSON file',
  )
  .option(
    '--file <path>',
    'Path to a CSV or JSON file with contact identifiers (required in non-interactive mode)',
  )
  .option(
    '--to-segment <id>',
    'Target segment ID to add contacts to (required)',
  )
  .option(
    '--from-segment <id>',
    'Source segment ID to remove contacts from (optional — omit to add-only)',
  )
  .option(
    '--column <name>',
    'CSV column name containing contact email or UUID (default: "email")',
    'email',
  )
  .option('--yes', 'Skip confirmation prompt')
  .option('--concurrency <n>', 'Max parallel API calls (default: 5)', '5')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Reads a list of contacts (email addresses or UUIDs) from a CSV or JSON file
and adds each contact to the target segment. Optionally removes them from a
source segment (set --from-segment for a true "move" operation).

CSV format:
  The file must have a header row. By default, the "email" column is used.
  Override with --column to use a different column name (e.g. "contact_id").

JSON format:
  An array of strings (emails or UUIDs):
  ["user1@example.com", "user2@example.com"]

  Or an array of objects with an "email" (or custom --column) key:
  [{"email": "user1@example.com"}, {"email": "user2@example.com"}]

Operations are executed with controlled concurrency (default 5).
Failures are collected and reported at the end — they do not stop the batch.`,
      output: `  {"migrated":<n>,"failed":<n>,"errors":[{"contact":"...","message":"..."}]}`,
      errorCodes: [
        'auth_error',
        'missing_file',
        'file_read_error',
        'invalid_csv',
        'invalid_json',
        'invalid_format',
        'missing_column',
        'missing_to_segment',
        'migrate_error',
      ],
      examples: [
        'resend contacts migrate --file ./contacts.csv --to-segment abc-123',
        'resend contacts migrate --file ./contacts.csv --to-segment abc-123 --from-segment def-456',
        'resend contacts migrate --file ./contacts.json --to-segment abc-123 --column contact_id',
        'resend contacts migrate --file ./contacts.csv --to-segment abc-123 --yes --json',
        'resend contacts migrate --file ./contacts.csv --to-segment abc-123 --concurrency 10',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    const filePath = await requireText(
      opts.file,
      { message: 'Path to CSV or JSON file', placeholder: './contacts.csv' },
      {
        message:
          'Missing --file flag. Provide a CSV or JSON file with contact identifiers.',
        code: 'missing_file',
      },
      globalOpts,
    );

    const toSegment = await requireText(
      opts.toSegment,
      {
        message: 'Target segment ID',
        placeholder: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
      },
      {
        message: 'Missing --to-segment flag.',
        code: 'missing_to_segment',
      },
      globalOpts,
    );

    const fromSegment = opts.fromSegment;
    const column = opts.column ?? 'email';
    const concurrency = Math.max(
      1,
      Number.parseInt(opts.concurrency ?? '5', 10) || 5,
    );

    const raw = readFile(filePath, globalOpts);

    // Detect format: JSON if starts with [ or {, otherwise CSV
    const trimmed = raw.trimStart();
    let contacts: string[];

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      contacts = parseJsonContacts(raw, column, globalOpts);
    } else {
      contacts = parseCsvContacts(raw, column, globalOpts);
    }

    if (contacts.length === 0) {
      outputError(
        {
          message: 'No contacts found in the input file.',
          code: 'invalid_format',
        },
        { json: globalOpts.json },
      );
    }

    // Confirmation
    if (!opts.yes && isInteractive()) {
      const action = fromSegment ? 'migrate' : 'add';
      const msg = fromSegment
        ? `${action} ${contacts.length} contact(s) from segment ${fromSegment} to segment ${toSegment}?`
        : `Add ${contacts.length} contact(s) to segment ${toSegment}?`;

      const confirmed = await p.confirm({ message: msg });
      if (p.isCancel(confirmed) || !confirmed) {
        cancelAndExit('Migration cancelled.');
      }
    }

    const spinner = createSpinner(
      `Migrating ${contacts.length} contact(s)...`,
      globalOpts.quiet,
    );

    let migrated = 0;
    let failed = 0;
    const errors: Array<{
      contact: string;
      operation: string;
      message: string;
    }> = [];

    // Process in concurrent batches
    const queue = [...contacts];
    const runTask = async (contactId: string) => {
      // 1. Add to target segment
      try {
        const addPayload = {
          ...segmentContactIdentifier(contactId),
          segmentId: toSegment,
        } as AddContactSegmentOptions;
        const { error } = await resend.contacts.segments.add(addPayload);
        if (error) {
          failed++;
          errors.push({
            contact: contactId,
            operation: 'add',
            message: error.message,
          });
          return;
        }
      } catch (err) {
        failed++;
        errors.push({
          contact: contactId,
          operation: 'add',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
        return;
      }

      // 2. Remove from source segment (if specified)
      if (fromSegment) {
        try {
          const removePayload = {
            ...segmentContactIdentifier(contactId),
            segmentId: fromSegment,
          };
          const { error } = await resend.contacts.segments.remove(
            removePayload as Parameters<
              typeof resend.contacts.segments.remove
            >[0],
          );
          if (error) {
            // The add succeeded but the remove failed — still count as partial failure
            failed++;
            errors.push({
              contact: contactId,
              operation: 'remove',
              message: error.message,
            });
            return;
          }
        } catch (err) {
          failed++;
          errors.push({
            contact: contactId,
            operation: 'remove',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
          return;
        }
      }

      migrated++;
      spinner.update(
        `Migrating contacts... ${migrated + failed}/${contacts.length}`,
      );
    };

    // Execute with concurrency limit
    await runWithConcurrency(queue, runTask, concurrency);

    if (failed > 0 && migrated > 0) {
      spinner.warn(
        `Migration complete: ${migrated} succeeded, ${failed} failed`,
      );
    } else if (failed > 0) {
      spinner.fail(`Migration failed: all ${failed} contact(s) failed`);
    } else {
      spinner.stop(`Migrated ${migrated} contact(s) successfully`);
    }

    const result = {
      migrated,
      failed,
      total: contacts.length,
      ...(errors.length > 0 && { errors }),
    };

    if (!globalOpts.json && isInteractive()) {
      console.log(`\n  Migrated: ${migrated}`);
      console.log(`  Failed:   ${failed}`);
      console.log(`  Total:    ${contacts.length}`);
      if (errors.length > 0) {
        console.log('\n  Errors:');
        for (const err of errors.slice(0, 20)) {
          console.log(`    [${err.operation}] ${err.contact}: ${err.message}`);
        }
        if (errors.length > 20) {
          console.log(`    ... and ${errors.length - 20} more`);
        }
      }
    } else {
      outputResult(result, { json: globalOpts.json });
    }
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonContacts(
  raw: string,
  column: string,
  globalOpts: GlobalOpts,
): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    outputError(
      { message: 'File content is not valid JSON.', code: 'invalid_json' },
      { json: globalOpts.json },
    );
  }

  if (!Array.isArray(parsed)) {
    outputError(
      {
        message: 'JSON file must contain an array of strings or objects.',
        code: 'invalid_format',
      },
      { json: globalOpts.json },
    );
  }

  return (parsed as unknown[]).map((item, i) => {
    if (typeof item === 'string') {
      return item;
    }
    if (typeof item === 'object' && item !== null && column in item) {
      return String((item as Record<string, unknown>)[column]);
    }
    return outputError(
      {
        message: `JSON entry at index ${i} is not a string and does not have a "${column}" key.`,
        code: 'invalid_format',
      },
      { json: globalOpts.json },
    );
  });
}

function parseCsvContacts(
  raw: string,
  column: string,
  globalOpts: GlobalOpts,
): string[] {
  const rows = parseCsv(raw, globalOpts);

  // Validate that the column exists
  const firstRow = rows[0];
  if (!(column in firstRow)) {
    const available = Object.keys(firstRow).join(', ');
    outputError(
      {
        message: `Column "${column}" not found in CSV. Available columns: ${available}`,
        code: 'missing_column',
      },
      { json: globalOpts.json },
    );
  }

  return rows.map((row) => row[column]).filter((v) => v !== '');
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (i < items.length) {
        const index = i++;
        await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
}
