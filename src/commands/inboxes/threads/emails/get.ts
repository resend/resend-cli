import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../../lib/actions';
import type { GlobalOpts } from '../../../../lib/client';
import { buildHelpText } from '../../../../lib/help-text';
import { pickId, requireText } from '../../../../lib/prompts';
import { snakeCaseAlias } from '../../../../lib/snake-case-alias';
import { inboxPickerConfig, resolveIdInputs } from '../../utils';
import { inboxThreadPickerConfig } from '../utils';

export const getInboxThreadEmailCommand = new Command('get')
  .description('Retrieve a single email from a thread')
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[threadId]', 'Thread UUID')
  .argument('[emailId]', 'Email UUID (from "threads emails list")')
  .option('--inbox-id <id>', 'Inbox UUID')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .option('--email-id <id>', 'Email UUID (from "threads emails list")')
  .addOption(snakeCaseAlias('--email-id <id>'))
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"cc":[],"bcc":[],"reply_to":[],"subject":"<subject>|null","message_id":"<message-id>|null","html":"<html>|null","text":"<text>|null","attachments":[{"id":"<id>","filename":"<name>|null","size":123|null}],"read":true,"received_at":"<date>"}`,
      errorCodes: ['auth_error', 'missing_id', 'fetch_error'],
      examples: [
        'resend inboxes threads emails get <inbox-id> <thread-id> <email-id>',
        'resend inboxes threads emails get <inbox-id> <thread-id> <email-id> --json',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, emailIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
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
      { message: 'Email ID', placeholder: 'from "threads emails list"' },
      {
        message:
          'Missing the email ID. Pass it as <emailId> or with --email-id.',
        code: 'missing_id',
      },
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
          if (data.text) {
            console.log(data.text);
          } else if (data.html) {
            console.log('(HTML body only. Use --json to view it.)');
          } else {
            console.log('(no body)');
          }
        },
      },
      globalOpts,
    );
  });
