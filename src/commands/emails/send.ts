import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { Attachment, CreateEmailOptions } from 'resend';
import {
  type AttachmentSpec,
  parseAttachmentSpec,
  parseAttachmentsJson,
} from '../../lib/attachments';
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

function serializeEmailPayloadForDryRun(payload: CreateEmailOptions): unknown {
  const { attachments, ...rest } = payload;
  if (!attachments?.length) {
    return rest;
  }
  return {
    ...rest,
    attachments: attachments.map((a) => ({
      ...(a.filename !== undefined && { filename: a.filename }),
      ...(a.path && { path: a.path }),
      ...(a.contentType && { contentType: a.contentType }),
      ...(a.contentId && { contentId: a.contentId }),
      ...(a.content !== undefined && {
        byteLength: Buffer.isBuffer(a.content)
          ? a.content.byteLength
          : Buffer.byteLength(String(a.content), 'utf8'),
      }),
    })),
  };
}

export const sendCommand = new Command('send')
  .description('Send an email')
  .option(
    '--from <address>',
    'Sender address (required unless using --template)',
  )
  .option('--to <addresses...>', 'Recipient address(es) (required)')
  .option(
    '--subject <subject>',
    'Email subject (required unless using --template)',
  )
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
  .option(
    '--attachment <specs...>',
    'File path or URL to attach, with optional ;cid= ;type= ;filename= params (quote the value)',
  )
  .option(
    '--attachments-file <path>',
    'Path to a JSON array of attachment objects (use "-" for stdin)',
  )
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
  .option(
    '--dry-run',
    'Validate input and print the request JSON without calling the API (interactive: verified-domain list is not fetched)',
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
        'Required: --to and either --template, --react-email, or (--from, --subject, and one of --text | --text-file | --html | --html-file).\nAttachments: --attachment takes a local path or https:// URL plus optional ;cid= (inline content-id), ;type= (MIME type), ;filename= params. Always double-quote values containing ";" — required on every shell (bash, PowerShell, cmd). For paths containing ";key=" or scripted use, pass a JSON array via --attachments-file.\nURL attachments are fetched by the API after send: an unreachable URL fails the email (check `emails get <id>`), and filename/MIME type are not derived from the URL — pass ;filename= and ;type=.\nUse --dry-run to print the request JSON without sending (attachment content shows byteLength only).',
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
        'invalid_attachment',
        'template_body_conflict',
        'template_attachment_conflict',
        'react_email_build_error',
        'react_email_render_error',
        'send_error',
      ],
      examples: [
        'resend emails send --from onboarding@resend.dev --to delivered@resend.dev --subject "Hello" --text "Hi"',
        'resend emails send --from onboarding@resend.dev --to delivered@resend.dev --subject "Hello" --html "<b>Hi</b>"',
        'resend emails send --from onboarding@resend.dev --to delivered@resend.dev --subject "Hello" --text "Hi" --attachment ./report.pdf',
        'resend emails send --from onboarding@resend.dev --to delivered@resend.dev --subject "Hello" --html "<img src=cid:logo>" --attachment "./logo.png;cid=logo"',
        'resend emails send --from onboarding@resend.dev --to delivered@resend.dev --subject "Hello" --text "Hi" --attachment "https://example.com/report.pdf;filename=report.pdf;type=application/pdf"',
        'resend emails send --from onboarding@resend.dev --to delivered@resend.dev --subject "Hello" --text "Hi" --attachments-file ./attachments.json',
        'resend emails send --template tmpl_123 --to delivered@resend.dev',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const stdinReaders = [opts.htmlFile, opts.textFile, opts.attachmentsFile];
    if (stdinReaders.filter((f) => f === '-').length > 1) {
      outputError(
        {
          message:
            'Only one of --html-file, --text-file, or --attachments-file can read from stdin ("-"). Pass the others as file paths.',
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

    if (
      hasTemplate &&
      (opts.attachment || opts.attachmentsFile !== undefined)
    ) {
      outputError(
        {
          message:
            'Cannot use --attachment or --attachments-file with --template',
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
            return [key, raw];
          }),
        )
      : undefined;

    let fromAddress = opts.from;
    if (
      !opts.dryRun &&
      !fromAddress &&
      !hasTemplate &&
      isInteractive() &&
      !globalOpts.json
    ) {
      const clientForDomains = await requireClient(globalOpts, {
        permission: 'sending_access',
      });
      const domains = await fetchVerifiedDomains(clientForDomains);
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

    let attachments: Attachment[] | undefined = opts.attachment?.map(
      (value) => {
        let spec: AttachmentSpec;
        try {
          spec = parseAttachmentSpec(value);
        } catch (err) {
          return outputError(
            { message: (err as Error).message, code: 'invalid_attachment' },
            { json: globalOpts.json },
          );
        }
        const metadata = {
          ...(spec.contentType && { contentType: spec.contentType }),
          ...(spec.contentId && { contentId: spec.contentId }),
        };
        if (spec.isUrl) {
          return {
            path: spec.source,
            ...(spec.filename && { filename: spec.filename }),
            ...metadata,
          };
        }
        try {
          const content = readFileSync(spec.source);
          return {
            filename: spec.filename ?? basename(spec.source),
            content,
            ...metadata,
          };
        } catch {
          return outputError(
            {
              message: `Failed to read file: ${spec.source}`,
              code: 'file_read_error',
            },
            { json: globalOpts.json },
          );
        }
      },
    );

    if (opts.attachmentsFile !== undefined) {
      const raw = readFile(opts.attachmentsFile, globalOpts);
      try {
        attachments = [...(attachments ?? []), ...parseAttachmentsJson(raw)];
      } catch (err) {
        outputError(
          { message: (err as Error).message, code: 'invalid_attachment' },
          { json: globalOpts.json },
        );
      }
    }

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

    if (opts.dryRun) {
      outputResult(
        {
          dryRun: true,
          request: serializeEmailPayloadForDryRun(payload),
        },
        { json: globalOpts.json },
      );
      return;
    }

    const resend = await requireClient(globalOpts, {
      permission: 'sending_access',
    });

    const data = await withSpinner(
      opts.scheduledAt ? 'Scheduling email...' : 'Sending email...',
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
        console.log(`Email scheduled: ${data.id}`);
      } else {
        console.log(`Email sent: ${data.id}`);
      }
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
