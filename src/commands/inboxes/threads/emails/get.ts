import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';

export const getInboxThreadEmailCommand = new Command('get')
  .description('Retrieve a single email from a thread')
  .argument('<inboxId>', 'Inbox UUID')
  .argument('<threadId>', 'Thread UUID')
  .argument('<emailId>', 'Email UUID (from "threads get")')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>|null","html":"<html>|null","text":"<text>|null","attachments":[{"id":"<id>","filename":"<name>|null","size":123}],"read":true,"received_at":"<date>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend inboxes threads emails get <inboxId> <threadId> <emailId>',
        'resend inboxes threads emails get <inboxId> <threadId> <emailId> --json',
      ],
    }),
  )
  .action(async (inboxId, threadId, emailId, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
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
