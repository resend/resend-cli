import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const getInboxDraftCommand = new Command('get')
  .description('Retrieve a draft by ID')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--draft_id <id>', 'Draft UUID')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"inbox_draft","id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>|null","html":"<html>|null","text":"<text>|null","thread_id":"<uuid>|null","reply_to_email_id":"<uuid>|null","email_id":"<uuid>|null","created_at":"<date>","updated_at":"<date>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend inboxes drafts get --inbox_id <inbox_id> --draft_id <draft_id>',
        'resend inboxes drafts get --inbox_id <inbox_id> --draft_id <draft_id> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const draftId = await pickId(
      opts.draft_id,
      inboxDraftPickerConfig(inboxId),
      globalOpts,
    );
    await runGet(
      {
        loading: 'Fetching draft...',
        sdkCall: (resend) => resend.inboxes.drafts.get({ inboxId, draftId }),
        onInteractive: (data) => {
          console.log(`${data.subject ?? '(no subject)'}`);
          console.log(`ID: ${data.id}`);
          console.log(`Type: ${data.type}`);
          if (data.to?.length) {
            console.log(`To: ${data.to.join(', ')}`);
          }
          console.log(`Updated: ${data.updated_at}`);
          console.log('');
          console.log(data.text ?? data.html ?? '(no body)');
        },
      },
      globalOpts,
    );
  });
