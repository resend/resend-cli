import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { outputError } from '../../../../lib/output';
import { pickId, requireText } from '../../../../lib/prompts';
import { inboxPickerConfig } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';

export const replyInboxThreadEmailCommand = new Command('reply')
  .description('Reply to an email in a thread')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--thread_id <id>', 'Thread UUID')
  .option('--email_id <id>', 'Email UUID to reply to (from "threads get")')
  .option('--text <text>', 'Plain text body of the reply')
  .option('--html <html>', 'HTML body of the reply')
  .option('--subject <subject>', 'Override the reply subject')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Sends the reply from the inbox address to the sender of the original email.
At least one of --text or --html is required.`,
      output: `  {"id":"<uuid>","email_id":"<uuid>","direction":"outbound","from":"<inbox-address>","to":["<recipient>"],"text":"<text>|null","html":"<html>|null","read":true,"received_at":"<date>"}`,
      errorCodes: [
        'auth_error',
        'missing_id',
        'missing_content',
        'create_error',
      ],
      examples: [
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --text "On it — reply to follow."',
        'resend inboxes threads emails reply --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --html "<p>Done!</p>" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const { text, html } = opts;
    if (!text && !html) {
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
      { message: 'Email ID to reply to', placeholder: 'from "threads get"' },
      { message: 'Missing --email_id flag.', code: 'missing_id' },
      globalOpts,
    );

    // The SDK requires at least one of text/html at the type level, which the
    // outputError never-return above guarantees but tsc cannot see across the
    // conditional spread — hence the explicit branch.
    const body = text
      ? { text, ...(html && { html }) }
      : { html: html as string };

    await runCreate(
      {
        loading: 'Sending reply...',
        sdkCall: (resend) =>
          resend.inboxes.threads.emails.reply({
            inboxId,
            threadId,
            emailId,
            ...body,
            ...(opts.subject && { subject: opts.subject }),
          }),
        onInteractive: (data) => {
          console.log(`Reply sent: ${data.email_id}`);
          console.log(`To: ${data.to.join(', ')}`);
        },
      },
      globalOpts,
    );
  });
