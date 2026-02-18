import { Command } from '@commander-js/extra-typings';
import { readFileSync } from 'node:fs';
import { createClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import * as p from '@clack/prompts';

export const batchCommand = new Command('batch')
  .description('Send up to 100 emails in a single API request from a JSON file')
  .option('--file <path>', 'Path to a JSON file containing an array of email objects (required in non-interactive mode)')
  .option('--idempotency-key <key>', 'Deduplicate this batch request using this key')
  .option('--validation-mode <mode>', 'permissive (default, partial success) or strict (fail all on any error)')
  .addHelpText('after', `
Required: --file (in non-interactive / piped mode)
Limit: 100 emails per request (API hard limit — warned if exceeded)
Unsupported per-email fields: attachments, scheduled_at

File format (--file path):
  [
    {"from":"you@domain.com","to":["user@example.com"],"subject":"Hello","text":"Hi"},
    {"from":"you@domain.com","to":["other@example.com"],"subject":"Hello","html":"<b>Hi</b>"}
  ]

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  [{"id":"<email-id>"},{"id":"<email-id>"}]

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | missing_file | file_read_error | invalid_json | invalid_format | batch_error

Examples:
  $ resend emails batch --file ./emails.json
  $ resend emails batch --file ./emails.json --json
  $ resend emails batch --file ./emails.json --idempotency-key my-batch-2026-02-18
  $ RESEND_API_KEY=re_123 resend emails batch --file ./emails.json --json`)
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as { apiKey?: string; json?: boolean };

    let resend;
    try {
      resend = createClient(globalOpts.apiKey);
    } catch (err) {
      outputError(
        { message: errorMessage(err, 'Failed to create client'), code: 'auth_error' },
        { json: globalOpts.json }
      );
    }

    let filePath = opts.file;

    if (!filePath) {
      if (!isInteractive()) {
        outputError(
          { message: 'Missing --file flag. Provide a JSON file with an array of email objects.', code: 'missing_file' },
          { json: globalOpts.json }
        );
      }

      const result = await p.text({
        message: 'Path to JSON file',
        placeholder: './emails.json',
        validate: (v) => (!v ? 'File path is required' : undefined),
      });
      if (p.isCancel(result)) cancelAndExit('Batch cancelled.');
      filePath = result;
    }

    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch (err) {
      outputError(
        { message: `Failed to read file: ${filePath}`, code: 'file_read_error' },
        { json: globalOpts.json }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      outputError(
        { message: 'File content is not valid JSON.', code: 'invalid_json' },
        { json: globalOpts.json }
      );
    }

    if (!Array.isArray(parsed)) {
      outputError(
        { message: 'File content must be a JSON array of email objects.', code: 'invalid_format' },
        { json: globalOpts.json }
      );
    }

    const emails: unknown[] = parsed;

    if (emails.length > 100) {
      console.warn(`Warning: ${emails.length} emails exceeds the 100-email limit. The API may reject this request.`);
    }

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i] as Record<string, unknown>;
      if ('attachments' in email) {
        outputError(
          { message: `Email at index ${i} contains "attachments", which is not supported in batch sends.`, code: 'batch_error' },
          { json: globalOpts.json }
        );
      }
      if ('scheduled_at' in email) {
        outputError(
          { message: `Email at index ${i} contains "scheduled_at", which is not supported in batch sends.`, code: 'batch_error' },
          { json: globalOpts.json }
        );
      }
    }

    const spinner = createSpinner('Sending batch...', 'helix');

    try {
      // Build send options. The Resend SDK (v6.x) does not yet expose the
      // Resend-Batch-Validation-Mode header, so --validation-mode is accepted
      // but has no effect until SDK support is added.
      const sendOpts: Record<string, unknown> = {};
      if (opts.idempotencyKey) sendOpts.idempotencyKey = opts.idempotencyKey;
      const { data, error } = await resend!.batch.send(emails as any, sendOpts as any);

      if (error) {
        spinner.fail('Failed to send batch');
        outputError(
          { message: error.message, code: 'batch_error' },
          { json: globalOpts.json }
        );
      }

      spinner.stop('Batch sent');

      const emailIds = data.data;
      if (!globalOpts.json && process.stdout.isTTY) {
        console.log(`Sent ${emailIds.length} email${emailIds.length === 1 ? '' : 's'}`);
        for (const email of emailIds) {
          console.log(`  ${email.id}`);
        }
      } else {
        outputResult(emailIds, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to send batch');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'batch_error' },
        { json: globalOpts.json }
      );
    }
  });
