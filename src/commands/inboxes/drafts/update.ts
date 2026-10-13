import { Command } from '@commander-js/extra-typings';
import type { UpdateInboxDraftOptions } from 'resend';
import { runWrite } from '../../../lib/actions';
import { resolveDraftAttachments } from '../../../lib/attachments';
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
  .description("Update a draft's recipients, subject, body, or attachments")
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--draft_id <id>', 'Draft UUID')
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
  .option(
    '--attachment <specs...>',
    'Local file to attach, replacing every attachment on the draft, with ;type= (MIME type) and optional ;filename= params (quote the value)',
  )
  .option(
    '--attachments-file <path>',
    'Path to a JSON array of attachment objects (use "-" for stdin)',
  )
  .option('--clear-attachments', 'Remove every attachment from the draft')
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one option is required. Provided fields replace the existing values.
Omitted fields are left unchanged.
Setting --text or --html replaces the whole body, so the body part you omit
becomes null. The merged draft must still contain at least one non-empty field,
and its combined recipients cannot exceed 50.
A draft that was already sent returns an error.
--attachment and --attachments-file replace every attachment on the draft.
--clear-attachments removes them all. Omit all three to keep them.
Attachments: --attachment takes a local file path plus ;type= (the MIME type)
and an optional ;filename=, as on "resend emails send". Quote values that contain ";".
--attachments-file takes a JSON array of objects with content (base64), filename
and content_type. Draft attachments need content, filename and content_type.
A URL or a ;cid= returns an error. The files on a draft can total at most 25 MB.
An empty file or a blocked file type, such as .exe, returns an error.`,
      output: `  {"object":"inbox_draft","id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>|null","html":"<html>|null","text":"<text>|null","thread_id":"<uuid>|null","reply_to_email_id":"<uuid>|null","email_id":"<uuid>|null","attachments":[{"id":"<uuid>","filename":"<name>","content_type":"<type>","size":123}],"created_at":"<date>","updated_at":"<date>"}`,
      errorCodes: [
        'auth_error',
        'no_changes',
        'invalid_options',
        'invalid_attachment',
        'file_read_error',
        'stdin_read_error',
        'update_error',
      ],
      examples: [
        'resend inboxes drafts update --inbox_id <inbox_id> --draft_id <draft_id> --subject "Updated subject"',
        'resend inboxes drafts update --inbox_id <inbox_id> --draft_id <draft_id> --text "New body" --json',
        'resend inboxes drafts update --inbox_id <inbox_id> --draft_id <draft_id> --attachment "./notes.txt;type=text/plain"',
        'resend inboxes drafts update --inbox_id <inbox_id> --draft_id <draft_id> --clear-attachments',
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
      opts.html !== undefined ||
      opts.attachment !== undefined ||
      opts.attachmentsFile !== undefined ||
      opts.clearAttachments === true;
    if (!hasChanges) {
      outputError(
        {
          message:
            'Provide at least one option to update: --to, --cc, --bcc, --subject, --text, --html, --attachment, --attachments-file, or --clear-attachments.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    if (
      opts.clearAttachments &&
      (opts.attachment !== undefined || opts.attachmentsFile !== undefined)
    ) {
      outputError(
        {
          message:
            'Use either --clear-attachments or --attachment/--attachments-file, not both.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }

    const attachments = opts.clearAttachments
      ? []
      : resolveDraftAttachments(
          opts.attachment,
          opts.attachmentsFile,
          globalOpts,
        );

    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    const draftId = await pickId(
      opts.draft_id,
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
      ...(attachments && { attachments }),
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
