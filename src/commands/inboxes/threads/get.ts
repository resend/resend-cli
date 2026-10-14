import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, resolveIdInputs } from '../utils';
import { inboxThreadPickerConfig } from './utils';

export const getInboxThreadCommand = new Command('get')
  .description('Retrieve a thread')
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[threadId]', 'Thread UUID')
  .option('--inbox-id <id>', 'Inbox UUID')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--thread-id <id>', 'Thread UUID')
  .addOption(snakeCaseAlias('--thread-id <id>'))
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Returns the thread summary. To read its messages, use "resend inboxes threads emails list".',
      output: `  {"object":"inbox_thread","id":"<uuid>","subject":"<subject>|null","folder":"inbox|archive|spam|sent|trash","labels":[],"read":true}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend inboxes threads get 78261eea-8f8b-4381-83c6-79fa7120f1cf 3deaccfa-f572-443c-be6f-92b74f9d5c48',
        'resend inboxes threads get 78261eea-8f8b-4381-83c6-79fa7120f1cf 3deaccfa-f572-443c-be6f-92b74f9d5c48 --json',
      ],
    }),
  )
  .action(async (inboxIdArg, threadIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        thread: [threadIdArg, opts.threadId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const threadId = await pickId(
      ids.thread,
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
        },
      },
      globalOpts,
    );
  });
