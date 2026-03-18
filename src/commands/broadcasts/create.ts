import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import type { CreateBroadcastOptions } from 'resend';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { readFile } from '../../lib/files';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
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
    'Path to an HTML file for the body (supports {{{FIRST_NAME|fallback}}} variable interpolation)',
  )
  .option('--text <text>', 'Plain-text body')
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
Body: provide exactly one of --html, --html-file, or --text.

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
        'create_error',
      ],
      examples: [
        'resend broadcasts create --from hello@domain.com --subject "Weekly Update" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --html "<p>Hello {{{FIRST_NAME|there}}}</p>"',
        'resend broadcasts create --from hello@domain.com --subject "Launch" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --html-file ./email.html --send',
        'resend broadcasts create --from hello@domain.com --subject "Launch" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --text "Hello!" --send --scheduled-at "tomorrow at 9am ET"',
        'resend broadcasts create --from hello@domain.com --subject "News" --segment-id 7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d --html "<p>Hi</p>" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    let from = opts.from;
    let subject = opts.subject;
    let segmentId = opts.segmentId;

    if (!from) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          { message: 'Missing --from flag.', code: 'missing_from' },
          { json: globalOpts.json },
        );
      }
      const result = await p.text({
        message: 'From address',
        placeholder: 'hello@domain.com',
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
        placeholder: 'Weekly Newsletter',
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
      html = readFile(opts.htmlFile, globalOpts);
    }

    if (!html && !text) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          {
            message: 'Missing body. Provide --html, --html-file, or --text.',
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
          success: opts.send ? 'Broadcast sent' : 'Broadcast created',
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
            console.log(`\nBroadcast sent: ${d.id}`);
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
