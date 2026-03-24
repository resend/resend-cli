import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { CreateEmailOptions } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { fetchVerifiedDomains, promptForFromAddress } from '../../lib/domains';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError, outputResult } from '../../lib/output';
import { promptForMissing, requireText } from '../../lib/prompts';
import { buildReactEmailHtml } from '../../lib/react-email';
import { withSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';

export const sendCommand = new Command('send')
  .description('Send an email')
  .option('--from <address>', 'Sender address (required)')
  .option('--to <addresses...>', 'Recipient address(es) (required)')
  .option('--subject <subject>', 'Email subject (required)')
  .option('--html <html>', 'HTML body')
  .option(
    '--html-file <path>',
    'Path to an HTML file for the body (use "-" for stdin)',
  )
  .option('--text <text>', 'Plain-text body')
  .option(
    '--text-file <path>',
    'Path to a plain-text file for the body (use "-" for stdin)',
  )
  .option(
    '--react-email <path>',
    'Path to a React Email template (.tsx) to bundle, render, and send',
  )
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
  .option('--template <id>', 'Template ID to use')
  .option(
    '--var <key=value...>',
    'Template variables as key=value pairs (repeatable, e.g. --var name=John --var count=42)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Required: --to and either --template, --react-email, or (--from, --subject, and one of --text | --text-file | --html | --html-file)',
      output: '  {"id":"<email-id>"}',
      errorCodes: [
        'auth_error',
        'missing_body',
        'file_read_error',
        'invalid_options',
        'stdin_read_error',
        'invalid_header',
        'invalid_tag',
        'invalid_var',
        'template_body_conflict',
        'template_attachment_conflict',
        'react_email_build_error',
        'react_email_render_error',
        'send_error',
      ],
      examples: [
        'resend emails send --from you@domain.com --to user@example.com --subject "Hello" --text "Hi"',
        'resend emails send --from you@domain.com --to a@example.com --to b@example.com --subject "Hi" --html "<b>Hi</b>" --json',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --html-file ./email.html --json',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hi" --scheduled-at 2024-08-05T11:52:01.858Z',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hi" --attachment ./report.pdf',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hi" --headers X-Entity-Ref-ID=123 --tags category=marketing',
        'resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text-file ./body.txt',
        'echo "Hello" | resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text-file -',
        'resend emails send --template tmpl_123 --to user@example.com',
        'resend emails send --template tmpl_123 --to user@example.com --var name=John --var count=42',
        'resend emails send --from you@domain.com --to user@example.com --subject "Welcome" --react-email ./emails/welcome.tsx',
        'RESEND_API_KEY=re_123 resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hi"',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (opts.htmlFile === '-' && opts.textFile === '-') {
      outputError(
        {
          message:
            'Cannot read both --html-file and --text-file from stdin. Pipe to one and pass the other as a file path.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    if (opts.from === '') {
      outputError(
        { message: '--from cannot be empty', code: 'invalid_options' },
        { json: globalOpts.json },
      );
    }

    const resend = await requireClient(globalOpts, {
      permission: 'sending_access',
    });

    const hasTemplate = !!opts.template;

    // Validate: --var requires --template
    if (opts.var && !hasTemplate) {
      outputError(
        {
          message: '--var can only be used with --template',
          code: 'invalid_var',
        },
        { json: globalOpts.json },
      );
    }

    // Validate: --react-email is mutually exclusive with body and template flags
    if (opts.reactEmail && (opts.html || opts.htmlFile || hasTemplate)) {
      outputError(
        {
          message:
            'Cannot use --react-email with --html, --html-file, or --template',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    // Validate: template and body flags are mutually exclusive
    if (
      hasTemplate &&
      (opts.html || opts.htmlFile || opts.text || opts.textFile)
    ) {
      outputError(
        {
          message:
            'Cannot use --template with --html, --html-file, --text, or --text-file',
          code: 'template_body_conflict',
        },
        { json: globalOpts.json },
      );
    }

    if (hasTemplate && opts.attachment) {
      outputError(
        {
          message: 'Cannot use --attachment with --template',
          code: 'template_attachment_conflict',
        },
        { json: globalOpts.json },
      );
    }

    // Parse key=value template variables
    const variables = opts.var
      ? Object.fromEntries(
          opts.var.map((v) => {
            const eq = v.indexOf('=');
            if (eq < 1) {
              outputError(
                {
                  message: `Invalid var format: "${v}". Expected key=value.`,
                  code: 'invalid_var',
                },
                { json: globalOpts.json },
              );
            }
            const key = v.slice(0, eq);
            const raw = v.slice(eq + 1);
            const num = Number(raw);
            return [key, raw !== '' && !Number.isNaN(num) ? num : raw];
          }),
        )
      : undefined;

    let fromAddress = opts.from;
    if (!fromAddress && !hasTemplate && isInteractive() && !globalOpts.json) {
      const domains = await fetchVerifiedDomains(resend);
      if (domains.length > 0) {
        fromAddress = await promptForFromAddress(domains);
      }
    }

    const promptFields = [
      {
        flag: 'from',
        message: 'From address',
        placeholder: 'onboarding@resend.dev',
        defaultValue: 'onboarding@resend.dev',
        required: !hasTemplate,
      },
      {
        flag: 'to',
        message: 'To address',
        placeholder: 'delivered@resend.dev',
        defaultValue: 'delivered@resend.dev',
      },
      {
        flag: 'subject',
        message: 'Subject',
        placeholder: 'Hello!',
        defaultValue: 'Hello!',
        required: !hasTemplate,
      },
    ];

    const filled = await promptForMissing(
      { from: fromAddress, to: opts.to?.[0], subject: opts.subject },
      promptFields,
      globalOpts,
    );

    let html = opts.html;
    let text = opts.text;

    if (opts.htmlFile) {
      if (opts.html) {
        process.stderr.write(
          'Warning: both --html and --html-file provided; using --html-file\n',
        );
      }
      html = readFile(opts.htmlFile, globalOpts);
    }

    if (opts.textFile) {
      if (opts.text) {
        process.stderr.write(
          'Warning: both --text and --text-file provided; using --text-file\n',
        );
      }
      text = readFile(opts.textFile, globalOpts);
    }

    if (opts.reactEmail) {
      html = await buildReactEmailHtml(opts.reactEmail, globalOpts);
    }

    let body: string | undefined = text;
    if (!hasTemplate && !opts.reactEmail && !html && !text) {
      body = await requireText(
        undefined,
        {
          message: 'Email body (plain text)',
          placeholder: 'Hello, World!',
          defaultValue: 'Hello, World!',
        },
        {
          message:
            'Missing email body. Provide --html, --html-file, --text, --text-file, or --react-email',
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

    // Build payload based on template vs content mode
    let payload: CreateEmailOptions;
    if (hasTemplate) {
      payload = {
        template: {
          id: opts.template as string,
          ...(variables && { variables }),
        },
        to: toAddresses,
        ...(filled.from && { from: filled.from }),
        ...(filled.subject && { subject: filled.subject }),
        ...(opts.cc && { cc: opts.cc }),
        ...(opts.bcc && { bcc: opts.bcc }),
        ...(opts.replyTo && { replyTo: opts.replyTo }),
        ...(opts.scheduledAt && { scheduledAt: opts.scheduledAt }),
        ...(headers && { headers }),
        ...(tags && { tags }),
      };
    } else {
      payload = {
        from: filled.from,
        to: toAddresses,
        subject: filled.subject,
        ...(html && { html }),
        ...(body && { text: body }),
        ...(opts.cc && { cc: opts.cc }),
        ...(opts.bcc && { bcc: opts.bcc }),
        ...(opts.replyTo && { replyTo: opts.replyTo }),
        ...(opts.scheduledAt && { scheduledAt: opts.scheduledAt }),
        ...(attachments && { attachments }),
        ...(headers && { headers }),
        ...(tags && { tags }),
      } as CreateEmailOptions;
    }

    const data = await withSpinner(
      {
        loading: opts.scheduledAt ? 'Scheduling email...' : 'Sending email...',
        success: opts.scheduledAt ? 'Email scheduled' : 'Email sent',
        fail: 'Failed to send email',
      },
      () =>
        resend.emails.send(
          payload,
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
