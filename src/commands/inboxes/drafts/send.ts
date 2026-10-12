import { Command } from '@commander-js/extra-typings';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const sendInboxDraftCommand = new Command('send')
  .description('Send a draft')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--draft_id <id>', 'Draft UUID')
  .option(
    '--idempotency-key <key>',
    'Deduplicate this send request using this key',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Sends the draft from the inbox address. A reply draft is sent in its thread.
A draft without a thread starts a new thread.
The draft must have at least one "to" recipient. A draft that was already sent
returns an error.
The output holds the ID of the sent email. Use it with "resend emails get".`,
      output: `  {"id":"<email-id>"}`,
      errorCodes: ['auth_error', 'send_error'],
      examples: [
        'resend inboxes drafts send --inbox_id <inbox_id> --draft_id <draft_id>',
        'resend inboxes drafts send --inbox_id <inbox_id> --draft_id <draft_id> --json',
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
    await runWrite(
      {
        loading: 'Sending draft...',
        sdkCall: (resend) =>
          resend.inboxes.drafts.send(
            { inboxId, draftId },
            opts.idempotencyKey
              ? { idempotencyKey: opts.idempotencyKey }
              : undefined,
          ),
        errorCode: 'send_error',
        successMsg: `Draft sent: ${draftId}`,
      },
      globalOpts,
    );
  });
