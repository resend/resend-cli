import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { Resend } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import {
  cancelAndExit,
  promptForMissing,
  requireText,
} from '../../lib/prompts';
import { withSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';

export async function fetchVerifiedDomains(resend: Resend): Promise<string[]> {
  try {
    const { data, error } = await resend.domains.list();
    if (error || !data) {
      return [];
    }
    return data.data
      .filter(
        (d) => d.status === 'verified' && d.capabilities.sending === 'enabled',
      )
      .map((d) => d.name);
  } catch {
    return [];
  }
}

const FROM_PREFIXES = ['noreply', 'hello', 'hi', 'info', 'support', 'team'];

async function promptForFromAddress(domains: string[]): Promise<string> {
  let domain: string;
  if (domains.length === 1) {
    domain = domains[0];
  } else {
    const result = await p.select({
      message: 'Select a verified domain',
      options: domains.map((d) => ({ value: d, label: d })),
    });
    if (p.isCancel(result)) {
      cancelAndExit('Send cancelled.');
    }
    domain = result;
  }

  const options: Array<{ value: string | null; label: string }> =
    FROM_PREFIXES.map((prefix) => ({
      value: `${prefix}@${domain}`,
      label: `${prefix}@${domain}`,
    }));
  options.push({ value: null, label: 'Custom address...' });

  const result = await p.select({
    message: `From address (@${domain})`,
    options,
  });
  if (p.isCancel(result)) {
    cancelAndExit('Send cancelled.');
  }

  if (result === null) {
    const custom = await p.text({
      message: 'From address',
      placeholder: `you@${domain}`,
      validate: (v) =>
        !v || !v.includes('@') ? 'Enter a valid email address' : undefined,
    });
    if (p.isCancel(custom)) {
      cancelAndExit('Send cancelled.');
    }
    return custom;
  }

  return result;
}

export const sendCommand = new Command('send')
  .description('Send an email')
  .option('--from <address>', 'Sender address (required)')
  .option('--to <addresses...>', 'Recipient address(es) (required)')
  .option('--subject <subject>', 'Email subject (required)')
  .option('--html <html>', 'HTML body')
  .option('--html-file <path>', 'Path to an HTML file for the body')
  .option('--text <text>', 'Plain-text body')
  .option('--cc <addresses...>', 'CC recipients')
  .option('--bcc <addresses...>', 'BCC recipients')
  .option('--reply-to <address>', 'Reply-to address')
  .option(
    '--scheduled-at <datetime>',
    'Schedule email for later — ISO 8601 or natural language e.g. "in 1 hour", "tomorrow at 9am ET"',
  )
  .option('--attachment <paths...>', 'File path(s) to attach')
  .option(
    '--headers <key=value...>',
    'Custom headers as key=value pairs (e.g. X-Entity-Ref-ID=123)',
  )
  .option(
    '--tags <name=value...>',
    'Email tags as name=value pairs (e.g. category=marketing)',
  )
  .option(
    '--idempotency-key <key>',
    'Deduplicate this send request using this key',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Required: --from, --to, --subject, and one of --text | --html | --html-file',
      output: '  {"id":"<email-id>"}',
      errorCodes: [
        'auth_error',
        'missing_body',
        'file_read_error',
        'invalid_header',
        'invalid_tag',
        'send_error',
      ],
      examples: [
        'resend emails send --from you@domain.com --to user@example.com --subject "Hello" --text "Hi"',
        'resend emails send --from you@domain.com --to a@example.com --to b@example.com --subject "Hi" --html "<b>Hi</b>" --json',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --html-file ./email.html --json',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hi" --scheduled-at 2024-08-05T11:52:01.858Z',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hi" --attachment ./report.pdf',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hi" --headers X-Entity-Ref-ID=123 --tags category=marketing',
        'RESEND_API_KEY=re_123 resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hi"',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = await requireClient(globalOpts);

    // Only fetch verified domains in interactive mode — non-interactive
    // callers (CI, agents, scripts) must pass --from explicitly.
    let fromAddress = opts.from;
    if (!fromAddress && isInteractive() && !globalOpts.json) {
      const domains = await fetchVerifiedDomains(resend);
      if (domains.length > 0) {
        fromAddress = await promptForFromAddress(domains);
      }
    }

    const filled = await promptForMissing(
      { from: fromAddress, to: opts.to?.[0], subject: opts.subject },
      [
        {
          flag: 'from',
          message: 'From address',
          placeholder: 'you@example.com',
        },
        {
          flag: 'to',
          message: 'To address',
          placeholder: 'recipient@example.com',
        },
        { flag: 'subject', message: 'Subject', placeholder: 'Hello!' },
      ],
      globalOpts,
    );

    let html = opts.html;
    const text = opts.text;

    if (opts.htmlFile) {
      html = readFile(opts.htmlFile, globalOpts);
    }

    let body: string | undefined = text;
    if (!html && !text) {
      body = await requireText(
        undefined,
        {
          message: 'Email body (plain text)',
          placeholder: 'Type your message...',
        },
        {
          message: 'Missing email body. Provide --html, --html-file, or --text',
          code: 'missing_body',
        },
        globalOpts,
      );
    }

    const toAddresses = opts.to ?? [filled.to];

    // Parse attachments from file paths
    const attachments = opts.attachment?.map((filePath) => {
      try {
        const content = readFileSync(filePath);
        return { filename: basename(filePath), content };
      } catch {
        return outputError(
          {
            message: `Failed to read file: ${filePath}`,
            code: 'file_read_error',
          },
          { json: globalOpts.json },
        );
      }
    });

    // Parse key=value headers
    const headers = opts.headers
      ? Object.fromEntries(
          opts.headers.map((h) => {
            const eq = h.indexOf('=');
            if (eq < 1) {
              outputError(
                {
                  message: `Invalid header format: "${h}". Expected key=value.`,
                  code: 'invalid_header',
                },
                { json: globalOpts.json },
              );
            }
            return [h.slice(0, eq), h.slice(eq + 1)];
          }),
        )
      : undefined;

    // Parse name=value tags
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

    const data = await withSpinner(
      {
        loading: opts.scheduledAt ? 'Scheduling email...' : 'Sending email...',
        success: opts.scheduledAt ? 'Email scheduled' : 'Email sent',
        fail: 'Failed to send email',
      },
      () =>
        resend.emails.send(
          {
            from: filled.from,
            to: toAddresses,
            subject: filled.subject,
            ...(html ? { html } : { text: body as string }),
            ...(opts.cc && { cc: opts.cc }),
            ...(opts.bcc && { bcc: opts.bcc }),
            ...(opts.replyTo && { replyTo: opts.replyTo }),
            ...(opts.scheduledAt && { scheduledAt: opts.scheduledAt }),
            ...(attachments && { attachments }),
            ...(headers && { headers }),
            ...(tags && { tags }),
          },
          opts.idempotencyKey
            ? { idempotencyKey: opts.idempotencyKey }
            : undefined,
        ),
      'send_error',
      globalOpts,
    );
    if (!globalOpts.json && isInteractive()) {
      if (opts.scheduledAt) {
        console.log(`\nEmail scheduled: ${data.id}`);
      } else {
        console.log(`\nEmail sent: ${data.id}`);
      }
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
