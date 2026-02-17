import { Command } from '@commander-js/extra-typings';
import { readFileSync } from 'node:fs';
import { createClient } from '../../lib/client';
import { promptForMissing } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';
import * as p from '@clack/prompts';

export const sendCommand = new Command('send')
  .description('Send an email')
  .option('--from <address>', 'Sender email address')
  .option('--to <addresses...>', 'Recipient email address(es)')
  .option('--subject <subject>', 'Email subject')
  .option('--html <html>', 'HTML body')
  .option('--html-file <path>', 'Path to HTML file for body')
  .option('--text <text>', 'Plain text body')
  .option('--cc <addresses...>', 'CC recipients')
  .option('--bcc <addresses...>', 'BCC recipients')
  .option('--reply-to <address>', 'Reply-to address')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as { apiKey?: string; json?: boolean };

    let resend;
    try {
      resend = createClient(globalOpts.apiKey);
    } catch (err) {
      outputError(
        { message: err instanceof Error ? err.message : 'Failed to create client', code: 'auth_error' },
        { json: globalOpts.json }
      );
      return; // unreachable, but TypeScript can't prove outputError exits inside catch
    }

    const filled = await promptForMissing(
      { from: opts.from, to: opts.to?.[0], subject: opts.subject },
      [
        { flag: 'from', message: 'From address', placeholder: 'you@example.com' },
        { flag: 'to', message: 'To address', placeholder: 'recipient@example.com' },
        { flag: 'subject', message: 'Subject', placeholder: 'Hello!' },
      ]
    );

    let html = opts.html;
    const text = opts.text;

    if (opts.htmlFile) {
      try {
        html = readFileSync(opts.htmlFile, 'utf-8');
      } catch (err) {
        outputError(
          { message: `Failed to read HTML file: ${opts.htmlFile}`, code: 'file_read_error' },
          { json: globalOpts.json }
        );
        return;
      }
    }

    let body: string | undefined = text;
    if (!html && !text) {
      if (!isInteractive()) {
        outputError(
          { message: 'Missing email body. Provide --html, --html-file, or --text', code: 'missing_body' },
          { json: globalOpts.json }
        );
      }
      const bodyResult = await p.text({
        message: 'Email body (plain text)',
        placeholder: 'Type your message...',
        validate: (v) => (!v || v.length === 0 ? 'Body is required' : undefined),
      });
      if (p.isCancel(bodyResult)) {
        p.cancel('Send cancelled.');
        process.exit(0);
      }
      body = bodyResult;
    }

    const toAddresses = opts.to ?? [filled.to!];

    const spinner = createSpinner('Sending email...', 'helix');

    try {
      const result = await resend!.emails.send({
        from: filled.from!,
        to: toAddresses,
        subject: filled.subject!,
        ...(html ? { html } : { text: body! }),
        ...(opts.cc && { cc: opts.cc }),
        ...(opts.bcc && { bcc: opts.bcc }),
        ...(opts.replyTo && { replyTo: opts.replyTo }),
      });

      if (result.error) {
        spinner.fail('Failed to send email');
        outputError(
          { message: result.error.message, code: result.error.name },
          { json: globalOpts.json }
        );
        return;
      }

      spinner.stop('Email sent');
      outputResult(result.data, { json: globalOpts.json });
    } catch (err) {
      spinner.fail('Failed to send email');
      outputError(
        { message: err instanceof Error ? err.message : 'Unknown error', code: 'send_error' },
        { json: globalOpts.json }
      );
    }
  });
