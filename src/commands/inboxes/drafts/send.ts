import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const sendInboxDraftCommand = new Command('send')
  .description('Send a draft')
  .option('--inbox-id <id>', 'Inbox UUID')
  .option('--draft-id <id>', 'Draft UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Sends the draft from the inbox address. The draft must have recipients and a body.',
      output: `  {"object":"inbox_draft","id":"<uuid>","thread_id":"<uuid>","email_id":"<uuid>"}`,
      errorCodes: ['auth_error', 'send_error'],
      examples: [
        'resend inboxes drafts send --inbox-id <inboxId> --draft-id <draftId>',
        'resend inboxes drafts send --inbox-id <inboxId> --draft-id <draftId> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inboxId, inboxPickerConfig, globalOpts);
    const draftId = await pickId(
      opts.draftId,
      inboxDraftPickerConfig(inboxId),
      globalOpts,
    );
    await runWrite(
      {
        loading: 'Sending draft...',
        sdkCall: (resend) => resend.inboxes.drafts.send({ inboxId, draftId }),
        errorCode: 'send_error',
        successMsg: `Draft sent: ${draftId}`,
      },
      globalOpts,
    );
  });
