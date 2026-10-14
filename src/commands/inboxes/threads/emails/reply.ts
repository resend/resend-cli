import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../../lib/actions';
import { resolveAttachments } from '../../../../lib/attachments';
import type { GlobalOpts } from '../../../../lib/client';
import { parseHeaderPairs } from '../../../../lib/headers';
import { buildHelpText } from '../../../../lib/help-text';
import { outputError } from '../../../../lib/output';
import { pickId, requireText } from '../../../../lib/prompts';
import { inboxPickerConfig } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';

const collectRecipients = (value: string, previous: string[]) => [
  ...previous,
  value,
];

export const replyInboxThreadEmailCommand = new Command('reply')
  .description('Reply to an email in a thread')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--thread_id <id>', 'Thread UUID')
  .option(
    '--email_id <id>',
    'Email UUID to reply to (from "threads emails list")',
  )
  .option(
    '--cc <address>',
    'Cc address (repeat the flag for multiple addresses)',
    collectRecipients,
    [] as string[],
  )
  .option(
    '--bcc <address>',
    'Bcc address (repeat the flag for multiple addresses)',
    collectRecipients,
    [] as string[],
  )
  .option('--text <text>', 'Plain text body of the reply')
  .option('--html <html>', 'HTML body of the reply')
  .option('--subject <subject>', 'Override the reply subject')
  .option(
    '--attachment <specs...>',
    'File path or URL to attach, with optional ;cid= ;type= ;filename= params (quote the value)',
  )
  .option(
    '--attachments-file <path>',
    'Path to a JSON array of attachment objects (use "-" for stdin)',
  )
  .option(
    '--reply-all',
    'Reply to everyone on the original email, not only its author',
  )
  .option(
    '--headers <key=value...>',
    'Custom headers as key=value pairs (e.g. X-Entity-Ref-ID=123)',
  )
  .option(
    '--idempotency-key <key>',
    'Deduplicate this send request using this key',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Sends the reply from the inbox address. The reply goes to the author of the
original email, or its Reply-To address if it has one. If the inbox sent the original
email, the reply goes to that email's "to" recipients.
At least one of --text or --html is required.
--reply-all also copies the other recipients. For a received email, the reply
goes to its Reply-To addresses, or to its sender, and copies the other addresses
of its "To" header and its "cc". For an email the inbox sent, the reply goes to
its Reply-To addresses when they are not the inbox address, otherwise to its "to"
recipients, and copies its other "to" recipients and its "cc". The inbox
address is always excluded, and duplicates are removed. Bcc is never copied.
--cc and --bcc add recipients. With --reply-all, --cc merges with the copied cc,
without duplicates.
The total number of recipients cannot exceed 50, counted after --reply-all adds everyone.
Attachments: --attachment takes a local path or an http:// or https:// URL plus optional
;cid=, ;type= and ;filename= params, as on "resend emails send". Quote values
that contain ";". --attachments-file takes a JSON array of attachment objects.
Up to 10 files. The content of all files can total at most 25 MB. A URL file
counts toward the 10 files only, because it is fetched when the email is sent.
An empty file, a blocked file type, or a URL that is not http or https, or that
points to localhost, returns an error.
--headers adds custom headers. In-Reply-To, References and Reply-To are reserved:
Resend sets them, and passing any of them, in any letter case, returns an error.
A header name cannot be empty, and names and values cannot contain line breaks
or null characters.
The output holds the ID of the sent email. Use it with "resend emails get".`,
      output: `  {"id":"<email-id>"}`,
      errorCodes: [
        'auth_error',
        'missing_id',
        'missing_content',
        'invalid_header',
        'invalid_attachment',
        'file_read_error',
        'stdin_read_error',
        'create_error',
      ],
      examples: [
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "On it — reply to follow."',
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --html "<p>Done!</p>" --json',
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "Looping in finance." --cc finance@example.com',
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "Thanks, all." --reply-all',
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "Invoice attached." --attachment ./invoice.pdf',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const { text, html } = opts;
    if (text === undefined && html === undefined) {
      outputError(
        {
          message: 'Provide --text or --html for the reply body.',
          code: 'missing_content',
        },
        { json: globalOpts.json },
      );
    }

    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      opts.thread_id,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );
    const emailId = await requireText(
      opts.email_id,
      {
        message: 'Email ID to reply to',
        placeholder: 'from "threads emails list"',
      },
      { message: 'Missing --email_id flag.', code: 'missing_id' },
      globalOpts,
    );

    // The SDK requires at least one of text/html at the type level, which the
    // outputError never-return above guarantees but tsc cannot see across the
    // conditional spread — hence the explicit branch.
    const body =
      text !== undefined
        ? { text, ...(html !== undefined && { html }) }
        : { html: html as string };

    const headers = parseHeaderPairs(opts.headers, globalOpts);
    const attachments = resolveAttachments(
      opts.attachment,
      opts.attachmentsFile,
      globalOpts,
    );

    await runCreate(
      {
        loading: 'Sending reply...',
        sdkCall: (resend) =>
          resend.inboxes.threads.emails.reply(
            {
              inboxId,
              threadId,
              emailId,
              ...body,
              ...(opts.cc.length > 0 && { cc: opts.cc }),
              ...(opts.bcc.length > 0 && { bcc: opts.bcc }),
              ...(opts.subject !== undefined && { subject: opts.subject }),
              ...(opts.replyAll && { replyAll: true }),
              ...(attachments && { attachments }),
              ...(headers && { headers }),
            },
            opts.idempotencyKey !== undefined
              ? { idempotencyKey: opts.idempotencyKey }
              : undefined,
          ),
        onInteractive: (data) => {
          console.log(`Reply sent: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
