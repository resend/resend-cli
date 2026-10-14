import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../../../lib/client';
import { requireClient } from '../../../lib/client';
import { parseHeaderPairs } from '../../../lib/headers';
import { buildHelpText } from '../../../lib/help-text';
import { outputResult } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { withSpinner } from '../../../lib/spinner';
import { isInteractive } from '../../../lib/tty';
import { inboxPickerConfig } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const sendInboxDraftCommand = new Command('send')
  .description('Send a draft')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--draft_id <id>', 'Draft UUID')
  .option(
    '--headers <key=value...>',
    'Custom headers as key=value pairs (e.g. X-Entity-Ref-ID=123)',
  )
  .option(
    '--idempotency-key <key>',
    'Deduplicate this send request using this key',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Sends the draft from the inbox address. A reply draft is sent in its thread.
A draft without a thread starts a new thread.
The draft must have at least one "to" recipient, a non-empty subject, and html
or text. A draft that was already sent returns an error.
--headers adds custom headers. In-Reply-To, References and Reply-To are reserved:
Resend sets them, and passing any of them, in any letter case, returns an error.
A header name cannot be empty, and names and values cannot contain line breaks
or null characters.
The output holds the ID of the sent email. Use it with "resend emails get".`,
      output: `  {"id":"<email-id>"}`,
      errorCodes: ['auth_error', 'invalid_header', 'send_error'],
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
    const headers = parseHeaderPairs(opts.headers, globalOpts);
    const resend = await requireClient(globalOpts);
    const data = await withSpinner(
      'Sending draft...',
      () =>
        resend.inboxes.drafts.send(
          { inboxId, draftId, ...(headers && { headers }) },
          opts.idempotencyKey !== undefined
            ? { idempotencyKey: opts.idempotencyKey }
            : undefined,
        ),
      'send_error',
      globalOpts,
    );
    if (!globalOpts.json && isInteractive()) {
      console.log(`Draft sent: ${data.id}`);
    } else {
      outputResult(data, { json: globalOpts.json });
    }
  });
