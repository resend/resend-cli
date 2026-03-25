import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { CreateBroadcastOptions } from 'resend';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { fetchVerifiedDomains, promptForFromAddress } from '../../lib/domains';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { buildReactEmailHtml } from '../../lib/react-email';
import { isInteractive } from '../../lib/tty';

export const createBroadcastCommand = new Command('create')
  .description('Create a broadcast draft (or send immediately with --send)')
  .option('--from <address>', 'Sender address — required')
  .option('--subject <subject>', 'Email subject — required')
  .option('--segment-id <id>', 'Target segment ID — required')
  .option(
    '--html <html>',
    'HTML body (supports {{{FIRST_NAME|fallback}}} triple-brace variable interpolation)',
  )
  .option(
    '--html-file <path>',
    'Path to an HTML file for the body (use "-" for stdin, supports {{{FIRST_NAME|fallback}}} variable interpolation)',
  )
  .option('--text <text>', 'Plain-text body')
  .option(
    '--text-file <path>',
    'Path to a plain-text file for the body (use "-" for stdin)',
  )
  .option(
    '--react-email <path>',
    'Path to a React Email template (.tsx) to bundle, render, and use as HTML body',
  )
  .option('--name <name>', 'Internal label for the broadcast (optional)')
  .option('--reply-to <address>', 'Reply-to address (optional)')
  .option(
    '--preview-text <text>',
    'Preview text shown in inbox below the subject line (optional)',
  )
  .option(
    '--topic-id <id>',
    'Associate with a topic for subscription filtering (optional)',
  )
  .option('--send', 'Send immediately on create instead of saving as draft')
  .option(
    '--scheduled-at <datetime>',
    'Schedule delivery — ISO 8601 or natural language e.g. "in 1 hour", "tomorrow at 9am ET" (only valid with --send)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --from, --subject, and --segment-id are required.
Body: provide at least one of --html, --html-file, --text, --text-file, or --react-email.

Variable interpolation:
  HTML bodies support triple-brace syntax for contact properties.
  Example: {{{FIRST_NAME|Friend}}} — uses FIRST_NAME or falls back to "Friend".

Scheduling:
  Use --scheduled-at with --send to schedule delivery.
  Accepts ISO 8601 (e.g. 2026-08-05T11:52:01Z) or natural language (e.g. "in 1 hour").
  --scheduled-at without --send is ignored.`,
      output: `  {"id":"<broadcast-id>"}`,
      errorCodes: [
        'auth_error',
        'missing_from',
        'missing_subject',
        'missing_segment',
        'missing_body',
        'file_read_error',
        'invalid_options',
        'stdin_read_error',
        'react_email_build_error',
        'react_email_render_error',
        'create_error',
      ],
      examples: [
        'resend broadcasts create --from hello@domain.com --subject "Weekly Update" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --html "<p>Hello {{{FIRST_NAME|there}}}</p>"',
        'resend broadcasts create --from hello@domain.com --subject "Launch" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --html-file ./email.html --send',
        'resend broadcasts create --from hello@domain.com --subject "Launch" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --text "Hello!" --send --scheduled-at "tomorrow at 9am ET"',
        'resend broadcasts create --from hello@domain.com --subject "News" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --html "<p>Hi</p>" --json',
        'echo "<p>Hello</p>" | resend broadcasts create --from hello@domain.com --subject "Update" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --html-file -',
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

    if (opts.reactEmail && (opts.html || opts.htmlFile)) {
      outputError(
        {
          message: 'Cannot use --react-email with --html or --html-file',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    const resend = await requireClient(globalOpts);

    let from = opts.from;
    let subject = opts.subject;
    let segmentId = opts.segmentId;

    if (!from && isInteractive() && !globalOpts.json) {
      const domains = await fetchVerifiedDomains(resend);
      if (domains.length > 0) {
        from = await promptForFromAddress(domains);
      }
    }

    if (!from) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --from flag.', code: 'missing_from' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'From address',
        placeholder: 'e.g. hello@domain.com',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      from = result;
    }

    if (!subject) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --subject flag.', code: 'missing_subject' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'Subject',
        placeholder: 'e.g. Weekly Newsletter',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      subject = result;
    }

    if (!segmentId) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --segment-id flag.', code: 'missing_segment' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'Segment ID',
        placeholder: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      segmentId = result;
    }

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

    if (!html && !text) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          {
            message:
              'Missing body. Provide --html, --html-file, --text, --text-file, or --react-email.',
            code: 'missing_body',
          },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'Body (plain text)',
        placeholder: 'Hello {{{FIRST_NAME|there}}}!',
        validate: (v) => (!v ? 'Required' : undefined),
      });
      if (p.isCancel(result)) {
        cancelAndExit('Cancelled.');
      }
      text = result;
    }

    await runCreate(
      {
        spinner: {
          loading: 'Creating broadcast...',
          success: opts.send
            ? opts.scheduledAt
              ? 'Broadcast scheduled'
              : 'Broadcast sent'
            : 'Broadcast created',
          fail: 'Failed to create broadcast',
        },
        sdkCall: (resend) =>
          resend.broadcasts.create({
            from,
            subject,
            segmentId,
            ...(html && { html }),
            ...(text && { text }),
            ...(opts.name && { name: opts.name }),
            ...(opts.replyTo && { replyTo: opts.replyTo }),
            ...(opts.previewText && { previewText: opts.previewText }),
            ...(opts.topicId && { topicId: opts.topicId }),
            ...(opts.send && { send: true as const }),
            ...(opts.send &&
              opts.scheduledAt && { scheduledAt: opts.scheduledAt }),
          } as CreateBroadcastOptions),
        onInteractive: (d) => {
          if (opts.send) {
            if (opts.scheduledAt) {
              console.log(`\nBroadcast scheduled: ${d.id}`);
            } else {
              console.log(`\nBroadcast sent: ${d.id}`);
            }
          } else {
            console.log(`\nBroadcast created: ${d.id}`);
            console.log('Status: draft');
            console.log(`\nSend it with: resend broadcasts send ${d.id}`);
          }
        },
      },
      globalOpts,
    );
  });
