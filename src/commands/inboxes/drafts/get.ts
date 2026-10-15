import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, resolveIdInputs } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const getInboxDraftCommand = new Command('get')
  .description('Retrieve a draft by ID')
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[draftId]', 'Draft UUID')
  .option('--inbox-id <id>', 'Inbox UUID')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--draft-id <id>', 'Draft UUID')
  .addOption(snakeCaseAlias('--draft-id <id>'))
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"inbox_draft","id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>|null","html":"<html>|null","text":"<text>|null","thread_id":"<uuid>|null","reply_to_email_id":"<uuid>|null","email_id":"<uuid>|null","attachments":[{"id":"<uuid>","filename":"<name>","content_type":"<type>","size":123}],"created_at":"<date>","updated_at":"<date>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend inboxes drafts get <inbox-id> <draft-id>',
        'resend inboxes drafts get <inbox-id> <draft-id> --json',
      ],
    }),
  )
  .action(async (inboxIdArg, draftIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        draft: [draftIdArg, opts.draftId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const draftId = await pickId(
      ids.draft,
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
          if (data.attachments.length > 0) {
            console.log(
              `Attachments: ${data.attachments.map((a) => a.filename).join(', ')}`,
            );
          }
          console.log(`Updated: ${data.updated_at}`);
          console.log('');
          console.log(data.text ?? data.html ?? '(no body)');
        },
      },
      globalOpts,
    );
  });
