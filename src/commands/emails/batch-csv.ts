import { Command, Option } from '@commander-js/extra-typings';
import type { CreateBatchEmailOptions, CreateBatchOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { parseCsv } from '../../lib/csv';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import { requireText } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';

const BATCH_API_LIMIT = 100;

export const batchCsvCommand = new Command('batch-csv')
  .description(
    'Send bulk emails from a CSV file, using a Resend template or inline body',
  )
  .option(
    '--file <path>',
    'Path to a CSV file (required in non-interactive mode)',
  )
  .option('--template-id <id>', 'Resend template ID to use for each email')
  .option(
    '--from <address>',
    'Sender address (required unless template provides it)',
  )
  .option(
    '--subject <subject>',
    'Email subject (required unless template provides it). Supports {{column}} placeholders.',
  )
  .option(
    '--html <html>',
    'Inline HTML body. Supports {{column}} placeholders.',
  )
  .option(
    '--html-file <path>',
    'Path to an HTML file for the body. Supports {{column}} placeholders.',
  )
  .option('--text <text>', 'Plain-text body. Supports {{column}} placeholders.')
  .option(
    '--to-column <name>',
    'CSV column containing recipient email addresses (default: "to")',
    'to',
  )
  .option('--reply-to <address>', 'Reply-to address for all emails')
  .option(
    '--tags <name=value...>',
    'Email tags as name=value pairs applied to all emails',
  )
  .option(
    '--idempotency-key <key>',
    'Deduplicate this batch request using this key',
  )
  .addOption(
    new Option(
      '--batch-validation <mode>',
      'Validation mode: strict (default, fail all on error) or permissive (partial success)',
    ).choices(['strict', 'permissive'] as const),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Reads a CSV file where each row represents one email recipient.
Uses the Resend batch API to send up to 100 emails per API call.
Files with more than 100 rows are automatically chunked into multiple requests.

Template mode (--template-id):
  The template's subject/body are used. CSV columns map to template variables.
  Any column not named "to" (or the --to-column value) is passed as a variable.

Inline mode (--html | --html-file | --text):
  Use {{column_name}} placeholders in subject/html/text to interpolate CSV values.

CSV format:
  Must have a header row. The "to" column (or --to-column) is required.

  Template example:
    to,first_name,plan
    alice@example.com,Alice,pro
    bob@example.com,Bob,free

  Inline example:
    to,name,message
    alice@example.com,Alice,Welcome aboard!
    bob@example.com,Bob,Thanks for signing up!

Limit: 100 emails per API request (auto-chunked for larger files).`,
      output: `  {"sent":<total>,"ids":[{"id":"..."},...],"chunks":<n>}`,
      errorCodes: [
        'auth_error',
        'missing_file',
        'file_read_error',
        'invalid_csv',
        'missing_column',
        'missing_body',
        'invalid_tag',
        'batch_csv_error',
      ],
      examples: [
        'resend emails batch-csv --file ./recipients.csv --template-id tmpl_abc --from you@domain.com',
        'resend emails batch-csv --file ./recipients.csv --from you@domain.com --subject "Hello {{name}}" --text "Hi {{name}}, welcome!"',
        'resend emails batch-csv --file ./recipients.csv --from you@domain.com --subject "Invoice" --html-file ./invoice.html',
        'resend emails batch-csv --file ./recipients.csv --template-id tmpl_abc --from you@domain.com --json',
        'resend emails batch-csv --file ./recipients.csv --template-id tmpl_abc --from you@domain.com --batch-validation permissive',
        'resend emails batch-csv --file ./recipients.csv --template-id tmpl_abc --from you@domain.com --to-column email',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const resend = requireClient(globalOpts);

    // ── Gather inputs ──────────────────────────────────────────────────

    const filePath = await requireText(
      opts.file,
      { message: 'Path to CSV file', placeholder: './recipients.csv' },
      {
        message: 'Missing --file flag. Provide a CSV file with recipient data.',
        code: 'missing_file',
      },
      globalOpts,
    );

    const toColumn = opts.toColumn ?? 'to';

    // Resolve body: template, inline html, html-file, or text
    const templateId = opts.templateId;
    let html = opts.html;
    const text = opts.text;

    if (opts.htmlFile) {
      html = readFile(opts.htmlFile, globalOpts);
    }

    if (!templateId && !html && !text) {
      outputError(
        {
          message:
            'Provide --template-id, --html, --html-file, or --text for the email body.',
          code: 'missing_body',
        },
        { json: globalOpts.json },
      );
    }

    const fromAddress = opts.from;
    const subject = opts.subject;

    // When not using a template, from and subject are mandatory
    if (!templateId) {
      if (!fromAddress) {
        outputError(
          {
            message:
              'Missing --from flag (required when not using a template).',
            code: 'missing_flags',
          },
          { json: globalOpts.json },
        );
      }
      if (!subject) {
        outputError(
          {
            message:
              'Missing --subject flag (required when not using a template).',
            code: 'missing_flags',
          },
          { json: globalOpts.json },
        );
      }
    }

    // Parse tags
    const tags = opts.tags?.map((t) => {
      const eq = t.indexOf('=');
      if (eq < 1) {
        outputError(
          {
            message: `Invalid tag format: "${t}". Expected name=value.`,
            code: 'invalid_tag',
          },
          { json: globalOpts.json },
        );
      }
      return { name: t.slice(0, eq), value: t.slice(eq + 1) };
    });

    // ── Parse CSV ──────────────────────────────────────────────────────

    const raw = readFile(filePath, globalOpts);
    const rows = parseCsv(raw, globalOpts);

    // Validate to-column exists
    if (!(toColumn in rows[0])) {
      const available = Object.keys(rows[0]).join(', ');
      outputError(
        {
          message: `Column "${toColumn}" not found in CSV. Available columns: ${available}`,
          code: 'missing_column',
        },
        { json: globalOpts.json },
      );
    }

    // ── Build email payloads ───────────────────────────────────────────

    const emails: CreateBatchEmailOptions[] = rows.map((row) => {
      const to = row[toColumn];
      if (!to) {
        outputError(
          {
            message: `Empty "${toColumn}" value in CSV row: ${JSON.stringify(row)}`,
            code: 'invalid_csv',
          },
          { json: globalOpts.json },
        );
      }

      // Collect all non-to columns as variables
      const variables: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        if (key !== toColumn && value !== '') {
          variables[key] = value;
        }
      }

      if (templateId) {
        // Template mode: pass CSV columns as template variables
        return {
          to,
          ...(fromAddress && { from: fromAddress }),
          ...(subject && { subject: interpolate(subject, variables) }),
          template: {
            id: templateId,
            ...(Object.keys(variables).length > 0 && { variables }),
          },
          ...(opts.replyTo && { replyTo: opts.replyTo }),
          ...(tags && { tags }),
        } as CreateBatchEmailOptions;
      }

      // Inline mode: interpolate placeholders in subject/html/text
      const interpolatedSubject = subject
        ? interpolate(subject, variables)
        : undefined;
      const interpolatedHtml = html ? interpolate(html, variables) : undefined;
      const interpolatedText = text ? interpolate(text, variables) : undefined;

      return {
        from: fromAddress as string,
        to,
        subject: interpolatedSubject as string,
        ...(interpolatedHtml ? { html: interpolatedHtml } : {}),
        ...(interpolatedText ? { text: interpolatedText } : {}),
        ...(opts.replyTo && { replyTo: opts.replyTo }),
        ...(tags && { tags }),
      } as CreateBatchEmailOptions;
    });

    // ── Send in chunks ─────────────────────────────────────────────────

    const chunks = chunkArray(emails, BATCH_API_LIMIT);
    const allIds: Array<{ id: string }> = [];
    const allErrors: Array<{ index: number; message: string }> = [];
    let totalSent = 0;

    const spinner = createSpinner(
      `Sending ${emails.length} email(s) in ${chunks.length} batch(es)...`,
      globalOpts.quiet,
    );

    const batchOptions = {
      ...(opts.idempotencyKey && { idempotencyKey: opts.idempotencyKey }),
      ...(opts.batchValidation && {
        batchValidation: opts.batchValidation as 'strict' | 'permissive',
      }),
    };
    const sendOptions =
      Object.keys(batchOptions).length > 0 ? batchOptions : undefined;

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      spinner.update(
        `Sending batch ${c + 1}/${chunks.length} (${chunk.length} emails)...`,
      );

      try {
        const result = await resend.batch.send(
          chunk as CreateBatchOptions,
          sendOptions,
        );

        if (result.error) {
          spinner.fail(`Batch ${c + 1} failed: ${result.error.message}`);
          // In strict mode with multiple chunks, record the error but continue
          for (let i = 0; i < chunk.length; i++) {
            allErrors.push({
              index: totalSent + i,
              message: result.error.message,
            });
          }
        } else if (result.data) {
          for (const email of result.data.data) {
            allIds.push(email);
          }
          const batchErrors = (
            result as { errors?: { index: number; message: string }[] }
          ).errors;
          if (batchErrors) {
            for (const err of batchErrors) {
              allErrors.push({
                index: totalSent + err.index,
                message: err.message,
              });
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        for (let i = 0; i < chunk.length; i++) {
          allErrors.push({ index: totalSent + i, message: msg });
        }
      }
      totalSent += chunk.length;
    }

    // ── Output ─────────────────────────────────────────────────────────

    if (allErrors.length > 0 && allIds.length > 0) {
      spinner.warn(
        `Sent ${allIds.length} email(s), ${allErrors.length} failed`,
      );
    } else if (allErrors.length > 0) {
      spinner.fail(`All ${allErrors.length} email(s) failed`);
    } else {
      spinner.stop(
        `Sent ${allIds.length} email(s) in ${chunks.length} batch(es)`,
      );
    }

    const result = {
      sent: allIds.length,
      ids: allIds,
      chunks: chunks.length,
      total: emails.length,
      ...(allErrors.length > 0 && { errors: allErrors }),
    };

    if (!globalOpts.json && isInteractive()) {
      console.log(`\n  Sent:   ${allIds.length}`);
      console.log(`  Failed: ${allErrors.length}`);
      console.log(`  Total:  ${emails.length}`);
      console.log(`  Chunks: ${chunks.length}`);
      if (allIds.length > 0 && allIds.length <= 20) {
        console.log('\n  Email IDs:');
        for (const email of allIds) {
          console.log(`    ${email.id}`);
        }
      } else if (allIds.length > 20) {
        console.log(`\n  First 20 email IDs:`);
        for (const email of allIds.slice(0, 20)) {
          console.log(`    ${email.id}`);
        }
        console.log(`    ... and ${allIds.length - 20} more`);
      }
      if (allErrors.length > 0) {
        console.log('\n  Errors:');
        for (const err of allErrors.slice(0, 20)) {
          console.log(`    [${err.index}] ${err.message}`);
        }
        if (allErrors.length > 20) {
          console.log(`    ... and ${allErrors.length - 20} more`);
        }
      }
    } else {
      outputResult(result, { json: globalOpts.json });
    }
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Replace {{key}} placeholders in a string with values from the provided map.
 * Unmatched placeholders are left as-is (the API or template engine handles them).
 */
function interpolate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in variables ? variables[key] : match;
  });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
