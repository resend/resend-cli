import { Command, Option } from '@commander-js/extra-typings';
import type { CreateBatchOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import { requireText } from '../../lib/prompts';
import { buildReactEmailHtml } from '../../lib/react-email';
import { withSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';

export const batchCommand = new Command('batch')
  .description('Send up to 100 emails in a single API request from a JSON file')
  .option(
    '--file <path>',
    'Path to a JSON file containing an array of email objects (use "-" for stdin; required in non-interactive mode)',
  )
  .option(
    '--react-email <path>',
    'Path to a React Email template (.tsx) — rendered HTML is set on every email in the batch',
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
      context:
        'Non-interactive: --file\nLimit: 100 emails per request (API hard limit — warned if exceeded)\nUnsupported per-email fields: attachments, scheduled_at\n\nFile format (--file path):\n  [\n    {"from":"onboarding@resend.com","to":["delivered@resend.com"],"subject":"Hello","text":"Hi"},\n    {"from":"onboarding@resend.com","to":["delivered@resend.com"],"subject":"Hello","html":"<b>Hi</b>"}\n  ]',
      output: '  [{"id":"<email-id>"},{"id":"<email-id>"}]',
      errorCodes: [
        'auth_error',
        'missing_file',
        'file_read_error',
        'stdin_read_error',
        'invalid_json',
        'invalid_format',
        'react_email_build_error',
        'react_email_render_error',
        'batch_error',
      ],
      examples: [
        'resend emails batch --file ./emails.json',
        'resend emails batch --file ./emails.json --batch-validation permissive',
        'echo \'[{"from":"onboarding@resend.com","to":["delivered@resend.com"],"subject":"Hi","text":"Hello"}]\' | resend emails batch --file -',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = await requireClient(globalOpts, {
      permission: 'sending_access',
    });

    const filePath = await requireText(
      opts.file,
      { message: 'Path to JSON file', placeholder: './emails.json' },
      {
        message:
          'Missing --file flag. Provide a JSON file with an array of email objects.',
        code: 'missing_file',
      },
      globalOpts,
    );

    const raw = readFile(filePath, globalOpts);

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
          message: 'File content must be a JSON array of email objects.',
          code: 'invalid_format',
        },
        { json: globalOpts.json },
      );
    }

    const emails = parsed as unknown[];

    if (emails.length > 100) {
      console.warn(
        `Warning: ${emails.length} emails exceeds the 100-email limit. The API may reject this request.`,
      );
    }

    if (opts.reactEmail) {
      const reactHtml = await buildReactEmailHtml(opts.reactEmail, globalOpts);
      for (const email of emails) {
        (email as Record<string, unknown>).html = reactHtml;
      }
    }

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      if (email === null || typeof email !== 'object' || Array.isArray(email)) {
        outputError(
          {
            message: `Email at index ${i} must be a JSON object.`,
            code: 'invalid_format',
          },
          { json: globalOpts.json },
        );
      }

      if ('attachments' in email) {
        outputError(
          {
            message: `Email at index ${i} contains "attachments", which is not supported in batch sends.`,
            code: 'batch_error',
          },
          { json: globalOpts.json },
        );
      }
      if ('scheduled_at' in email) {
        outputError(
          {
            message: `Email at index ${i} contains "scheduled_at", which is not supported in batch sends.`,
            code: 'batch_error',
          },
          { json: globalOpts.json },
        );
      }
    }

    const batchData = await withSpinner(
      {
        loading: 'Sending batch...',
        success: 'Batch sent',
        fail: 'Failed to send batch',
      },
      () => {
        const options = {
          ...(opts.idempotencyKey && { idempotencyKey: opts.idempotencyKey }),
          ...(opts.batchValidation && {
            batchValidation: opts.batchValidation as 'strict' | 'permissive',
          }),
        };
        return resend.batch.send(
          emails as CreateBatchOptions,
          Object.keys(options).length > 0 ? options : undefined,
        );
      },
      'batch_error',
      globalOpts,
    );

    const emailIds = batchData.data;
    const batchErrors = (
      batchData as { errors?: { index: number; message: string }[] }
    ).errors;

    if (!globalOpts.json && isInteractive()) {
      console.log(
        `Sent ${emailIds.length} email${emailIds.length === 1 ? '' : 's'}`,
      );
      for (const email of emailIds) {
        console.log(`  ${email.id}`);
      }
      if (batchErrors && batchErrors.length > 0) {
        console.warn(
          `\n${batchErrors.length} email${batchErrors.length === 1 ? '' : 's'} failed:`,
        );
        for (const err of batchErrors) {
          console.warn(`  [${err.index}] ${err.message}`);
        }
      }
    } else {
      outputResult(
        batchErrors && batchErrors.length > 0
          ? { data: emailIds, errors: batchErrors }
          : emailIds,
        { json: globalOpts.json },
      );
    }
  });
