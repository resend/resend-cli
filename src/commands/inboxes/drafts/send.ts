import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { parseHeaderPairs } from '../../../lib/headers';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const sendInboxDraftCommand = new Command('send')
  .description('Send a draft')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .argument('[draftId]', 'Draft UUID')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--draft-id <id>', 'Draft UUID')
  .addOption(snakeCaseAlias('--draft-id <id>'))
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
The draft must have at least one "to" recipient and html or text. A standalone
draft also needs a non-empty subject. A reply draft without a subject is sent
with the subject of the thread, prefixed with "Re:" when it does not already
start with it. A draft that was already sent returns an error.
--headers adds custom headers. In-Reply-To, References and Reply-To are reserved:
Resend sets them, and passing any of them, in any letter case, returns an error.
A header name cannot be empty, and names and values cannot contain line breaks
or null characters.
The output holds the ID of the sent email. Use it with "resend emails get".`,
      output: `  {"id":"<email-id>"}`,
      errorCodes: ['auth_error', 'invalid_header', 'send_error'],
      examples: [
        'resend inboxes drafts send <inbox-id> <draft-id>',
        'resend inboxes drafts send <inbox-id> <draft-id> --json',
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
    const headers = parseHeaderPairs(opts.headers, globalOpts);
    await runCreate(
      {
        loading: 'Sending draft...',
        permission: 'sending_access',
        sdkCall: (resend) =>
          resend.inboxes.drafts.send(
            { ...inboxSelector(inboxId), draftId, ...(headers && { headers }) },
            opts.idempotencyKey !== undefined
              ? { idempotencyKey: opts.idempotencyKey }
              : undefined,
          ),
        errorCode: 'send_error',
        onInteractive: (data) => {
          console.log(`Draft sent: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
