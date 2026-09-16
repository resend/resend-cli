import { Command } from '@commander-js/extra-typings';
import type { UpdateInboxDraftOptions } from 'resend';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { inboxDraftPickerConfig } from './utils';

const collectRecipients = (value: string, previous: string[]) => [
  ...previous,
  value,
];

export const updateInboxDraftCommand = new Command('update')
  .description("Update a draft's recipients, subject, or body")
  .option('--inbox-id <id>', 'Inbox UUID')
  .option('--draft-id <id>', 'Draft UUID')
  .option(
    '--to <address>',
    'Replace recipients (repeatable)',
    collectRecipients,
    [] as string[],
  )
  .option(
    '--cc <address>',
    'Replace cc addresses (repeatable)',
    collectRecipients,
    [] as string[],
  )
  .option(
    '--bcc <address>',
    'Replace bcc addresses (repeatable)',
    collectRecipients,
    [] as string[],
  )
  .option('--subject <subject>', 'New subject')
  .option('--text <text>', 'New plain text body')
  .option('--html <html>', 'New HTML body')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'At least one option is required. Provided fields replace the existing values.',
      output: `  {"object":"inbox_draft","id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>|null","html":"<html>|null","text":"<text>|null","thread_id":"<uuid>|null","reply_to_email_id":"<uuid>|null","email_id":"<uuid>|null","created_at":"<date>","updated_at":"<date>"}`,
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend inboxes drafts update --inbox-id <inboxId> --draft-id <draftId> --subject "Updated subject"',
        'resend inboxes drafts update --inbox-id <inboxId> --draft-id <draftId> --text "New body" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const hasChanges =
      opts.to.length > 0 ||
      opts.cc.length > 0 ||
      opts.bcc.length > 0 ||
      opts.subject !== undefined ||
      opts.text !== undefined ||
      opts.html !== undefined;
    if (!hasChanges) {
      outputError(
        {
          message:
            'Provide at least one option to update: --to, --cc, --bcc, --subject, --text, or --html.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const inboxId = await pickId(opts.inboxId, inboxPickerConfig, globalOpts);
    const draftId = await pickId(
      opts.draftId,
      inboxDraftPickerConfig(inboxId),
      globalOpts,
    );

    // The SDK requires at least one change at the type level, guaranteed by
    // the no_changes guard but not provable by tsc across conditional spreads.
    const payload = {
      inboxId,
      draftId,
      ...(opts.to.length > 0 && { to: opts.to }),
      ...(opts.cc.length > 0 && { cc: opts.cc }),
      ...(opts.bcc.length > 0 && { bcc: opts.bcc }),
      ...(opts.subject !== undefined && { subject: opts.subject }),
      ...(opts.text !== undefined && { text: opts.text }),
      ...(opts.html !== undefined && { html: opts.html }),
    } as UpdateInboxDraftOptions;

    await runWrite(
      {
        loading: 'Updating draft...',
        sdkCall: (resend) => resend.inboxes.drafts.update(payload),
        errorCode: 'update_error',
        successMsg: `Draft updated: ${draftId}`,
      },
      globalOpts,
    );
  });
