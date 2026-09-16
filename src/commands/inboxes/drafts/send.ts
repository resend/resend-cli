import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const sendInboxDraftCommand = new Command('send')
  .description('Send a draft')
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[draftId]', 'Draft UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Sends the draft from the inbox address. The draft must have recipients and a body.',
      output: `  {"object":"inbox_draft","id":"<uuid>","thread_id":"<uuid>","email_id":"<uuid>"}`,
      errorCodes: ['auth_error', 'send_error'],
      examples: [
        'resend inboxes drafts send <inboxId> <draftId>',
        'resend inboxes drafts send <inboxId> <draftId> --json',
      ],
    }),
  )
  .action(async (inboxIdArg, draftIdArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(inboxIdArg, inboxPickerConfig, globalOpts);
    const draftId = await pickId(
      draftIdArg,
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
