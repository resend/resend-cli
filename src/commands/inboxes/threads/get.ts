import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxThreadPickerConfig } from './utils';

export const getInboxThreadCommand = new Command('get')
  .description('Retrieve a thread with all of its messages')
  .option('--inbox-id <id>', 'Inbox UUID')
  .option('--thread-id <id>', 'Thread UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Returns the thread summary and every message in the thread, including html and text bodies.',
      output: `  {"object":"inbox_thread","id":"<uuid>","subject":"<subject>|null","folder":"inbox|archive|spam|sent|trash","labels":[],"read":true,"messages":{"has_more":false,"data":[{"id":"<uuid>","direction":"inbound|outbound","from":"<sender>","to":[],"subject":"<subject>|null","html":"<html>|null","text":"<text>|null","attachments":[],"read":true,"received_at":"<date>"}]}}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend inboxes threads get --inbox-id 78261eea-8f8b-4381-83c6-79fa7120f1cf --thread-id 3deaccfa-f572-443c-be6f-92b74f9d5c48',
        'resend inboxes threads get --inbox-id 78261eea-8f8b-4381-83c6-79fa7120f1cf --thread-id 3deaccfa-f572-443c-be6f-92b74f9d5c48 --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inboxId, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      opts.threadId,
      inboxThreadPickerConfig(inboxId),
      globalOpts,
    );
    await runGet(
      {
        loading: 'Fetching thread...',
        sdkCall: (resend) => resend.inboxes.threads.get({ inboxId, threadId }),
        onInteractive: (data) => {
          console.log(`${data.subject ?? '(no subject)'}`);
          console.log(`ID: ${data.id}`);
          console.log(`Folder: ${data.folder}`);
          if (data.labels.length > 0) {
            console.log(`Labels: ${data.labels.map((l) => l.name).join(', ')}`);
          }
          console.log(`Read: ${data.read ? 'yes' : 'no'}`);
          for (const message of data.messages.data) {
            console.log('');
            console.log(
              `[${message.direction}] ${message.from} · ${message.received_at}`,
            );
            console.log(`Email ID: ${message.id}`);
            const body = message.text ?? message.html ?? '(no body)';
            console.log(body);
          }
        },
      },
      globalOpts,
    );
  });
