import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { pickId, requireText } from '../../../../lib/prompts';
import { inboxPickerConfig } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';

export const getInboxThreadEmailCommand = new Command('get')
  .description('Retrieve a single email from a thread')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--thread_id <id>', 'Thread UUID')
  .option('--email_id <id>', 'Email UUID (from "threads get")')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>|null","html":"<html>|null","text":"<text>|null","attachments":[{"id":"<id>","filename":"<name>|null","size":123}],"read":true,"received_at":"<date>"}`,
      errorCodes: ['auth_error', 'missing_id', 'fetch_error'],
      examples: [
        'resend inboxes threads emails get --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id>',
        'resend inboxes threads emails get --inbox_id <inbox_id> --thread_id <thread_id> --email_id <email_id> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      opts.thread_id,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );
    const emailId = await requireText(
      opts.email_id,
      { message: 'Email ID', placeholder: 'from "threads get"' },
      { message: 'Missing --email_id flag.', code: 'missing_id' },
      globalOpts,
    );
    await runGet(
      {
        loading: 'Fetching email...',
        sdkCall: (resend) =>
          resend.inboxes.threads.emails.get({ inboxId, threadId, emailId }),
        onInteractive: (data) => {
          console.log(`${data.subject ?? '(no subject)'}`);
          console.log(`ID: ${data.id}`);
          console.log(`[${data.direction}] ${data.from} · ${data.received_at}`);
          console.log(`To: ${data.to.join(', ')}`);
          if (data.attachments.length > 0) {
            console.log(
              `Attachments: ${data.attachments
                .map((a) => a.filename ?? a.id)
                .join(', ')}`,
            );
          }
          console.log('');
          console.log(data.text ?? data.html ?? '(no body)');
        },
      },
      globalOpts,
    );
  });
