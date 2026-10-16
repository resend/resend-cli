import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../../lib/actions';
import { resolveAttachments } from '../../../../lib/attachments';
import type { GlobalOpts } from '../../../../lib/client';
import { parseHeaderPairs } from '../../../../lib/headers';
import { buildHelpText } from '../../../../lib/help-text';
import { outputError } from '../../../../lib/output';
import { pickId, requireText } from '../../../../lib/prompts';
import { snakeCaseAlias } from '../../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';

export const forwardInboxThreadEmailCommand = new Command('forward')
  .description('Forward an email in a thread to other recipients')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .argument('[threadId]', 'Thread UUID')
  .argument('[emailId]', 'Email UUID to forward (from "threads emails list")')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .option(
    '--email-id <id>',
    'Email UUID to forward (from "threads emails list")',
  )
  .addOption(snakeCaseAlias('--email-id <id>'))
  .option('--to <addresses...>', 'Recipient addresses (required)')
  .option('--cc <addresses...>', 'Cc addresses')
  .option('--bcc <addresses...>', 'Bcc addresses')
  .option('--text <text>', 'Plain text note to include with the forward')
  .option('--html <html>', 'HTML note to include with the forward')
  .option('--subject <subject>', 'Override the forwarded subject')
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
    '--idempotency-key <key>',
    'Deduplicate this send request using this key',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Forwards the email from the inbox address. --to is required. --text or --html
adds an optional note above the quoted original.
--to, --cc, and --bcc combined cannot exceed 50 recipients.
The attachments of the original email are sent with the forward, together with
any files you add. Together they can have at most 25 MB of content. A URL file
does not count toward the 25 MB, because it is fetched when the email is sent.
An empty file, a blocked file type, or a URL that does not start with http or
that starts with http://localhost: returns an error. Other URL problems fail
the email when it is sent.
An original attachment that was sent from a URL cannot be forwarded, and the
request returns an error.
Attachments: --attachment takes a local path or an http:// or https:// URL plus optional
;cid=, ;type= and ;filename= params, as on "resend emails send". Quote values
that contain ";". --attachments-file takes a JSON array of attachment objects.
--headers adds custom headers. In-Reply-To, References and Reply-To are reserved:
Resend sets them, and passing any of them, in any letter case, returns an error.
A header name cannot be empty, and names and values cannot contain line breaks
or null characters.
The output holds the ID of the sent email. Use it with "resend emails get".`,
      output: `  {"id":"<email-id>"}`,
      errorCodes: [
        'auth_error',
        'missing_id',
        'missing_to',
        'invalid_header',
        'invalid_attachment',
        'file_read_error',
        'stdin_read_error',
        'create_error',
      ],
      examples: [
        'resend inboxes threads emails forward <inbox-id> <thread-id> <email-id> --to teammate@example.com',
        'resend inboxes threads emails forward <inbox-id> <thread-id> <email-id> --to a@x.com b@x.com --cc c@x.com --text "FYI" --json',
        'resend inboxes threads emails forward <inbox-id> <thread-id> <email-id> --to teammate@example.com --attachment ./notes.txt',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, emailIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const { to } = opts;
    if (to === undefined) {
      outputError(
        {
          message: 'Provide at least one recipient with --to.',
          code: 'missing_to',
        },
        { json: globalOpts.json },
      );
    }

    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        thread: [threadIdArg, opts.threadId],
        email: [emailIdArg, opts.emailId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      ids.thread,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );
    const emailId = await requireText(
      ids.email,
      {
        message: 'Email ID to forward',
        placeholder: 'from "threads emails list"',
      },
      {
        message:
          'Missing the email ID. Pass it as <emailId> or with --email-id.',
        code: 'missing_id',
      },
      globalOpts,
    );

    const headers = parseHeaderPairs(opts.headers, globalOpts);
    const attachments = resolveAttachments(
      opts.attachment,
      opts.attachmentsFile,
      globalOpts,
    );

    await runCreate(
      {
        loading: 'Forwarding email...',
        permission: 'sending_access',
        sdkCall: (resend) =>
          resend.inboxes.threads.emails.forward(
            {
              ...inboxSelector(inboxId),
              threadId,
              emailId,
              to,
              ...(opts.cc && { cc: opts.cc }),
              ...(opts.bcc && { bcc: opts.bcc }),
              ...(opts.text !== undefined && { text: opts.text }),
              ...(opts.html !== undefined && { html: opts.html }),
              ...(opts.subject !== undefined && { subject: opts.subject }),
              ...(attachments && { attachments }),
              ...(headers && { headers }),
            },
            opts.idempotencyKey !== undefined
              ? { idempotencyKey: opts.idempotencyKey }
              : undefined,
          ),
        onInteractive: (data) => {
          console.log(`Email forwarded: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
