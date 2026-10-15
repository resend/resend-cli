import { Command } from '@commander-js/extra-typings';
import type { UpdateInboxDraftOptions } from 'resend';
import { runWrite } from '../../../lib/actions';
import { resolveDraftAttachments } from '../../../lib/attachments';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, resolveIdInputs } from '../utils';
import { inboxDraftPickerConfig } from './utils';

export const updateInboxDraftCommand = new Command('update')
  .description("Update a draft's recipients, subject, body, or attachments")
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[draftId]', 'Draft UUID')
  .option('--inbox-id <id>', 'Inbox UUID')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--draft-id <id>', 'Draft UUID')
  .addOption(snakeCaseAlias('--draft-id <id>'))
  .option('--to <addresses...>', 'Replace the recipients')
  .option('--clear-to', 'Remove every recipient from the draft')
  .option('--cc <addresses...>', 'Replace the cc addresses')
  .option('--clear-cc', 'Remove every cc address from the draft')
  .option('--bcc <addresses...>', 'Replace the bcc addresses')
  .option('--clear-bcc', 'Remove every bcc address from the draft')
  .option('--subject <subject>', 'New subject')
  .option('--clear-subject', 'Remove the subject from the draft')
  .option('--text <text>', 'New plain text body')
  .option('--clear-text', 'Remove the plain text body from the draft')
  .option('--html <html>', 'New HTML body')
  .option('--clear-html', 'Remove the HTML body from the draft')
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
--clear-to, --clear-cc, --clear-bcc, --clear-subject, --clear-text and
--clear-html set the field to null. A clear option and a value for the same
field return an error. --clear-text and --clear-html also replace the whole
body, so the body part you omit becomes null.
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
        'resend inboxes drafts update <inbox-id> <draft-id> --subject "Updated subject"',
        'resend inboxes drafts update <inbox-id> <draft-id> --text "New body" --json',
        'resend inboxes drafts update <inbox-id> <draft-id> --attachment "./notes.txt;type=text/plain"',
        'resend inboxes drafts update <inbox-id> <draft-id> --clear-attachments',
        'resend inboxes drafts update <inbox-id> <draft-id> --to ada@example.com grace@example.com --clear-cc',
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

    const fields = {
      to: [opts.to, opts.clearTo],
      cc: [opts.cc, opts.clearCc],
      bcc: [opts.bcc, opts.clearBcc],
      subject: [opts.subject, opts.clearSubject],
      text: [opts.text, opts.clearText],
      html: [opts.html, opts.clearHtml],
    } as const;

    const hasChanges =
      Object.values(fields).some(
        ([value, clear]) => value !== undefined || clear === true,
      ) ||
      opts.attachment !== undefined ||
      opts.attachmentsFile !== undefined ||
      opts.clearAttachments === true;
    if (!hasChanges) {
      outputError(
        {
          message:
            'Provide at least one option to update: --to, --cc, --bcc, --subject, --text, --html, --attachment, --attachments-file, or a --clear-* option.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    for (const [name, [value, clear]] of Object.entries(fields)) {
      if (clear && value !== undefined) {
        outputError(
          {
            message: `Use either --clear-${name} or --${name}, not both.`,
            code: 'invalid_options',
          },
          { json: globalOpts.json },
        );
      }
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

    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const draftId = await pickId(
      ids.draft,
      inboxDraftPickerConfig(inboxId),
      globalOpts,
    );

    // The SDK requires at least one change at the type level, guaranteed by
    // the no_changes guard but not provable by tsc across conditional spreads.
    const payload = {
      inboxId,
      draftId,
      ...(opts.to !== undefined && { to: opts.to }),
      ...(opts.clearTo && { to: null }),
      ...(opts.cc !== undefined && { cc: opts.cc }),
      ...(opts.clearCc && { cc: null }),
      ...(opts.bcc !== undefined && { bcc: opts.bcc }),
      ...(opts.clearBcc && { bcc: null }),
      ...(opts.subject !== undefined && { subject: opts.subject }),
      ...(opts.clearSubject && { subject: null }),
      ...(opts.text !== undefined && { text: opts.text }),
      ...(opts.clearText && { text: null }),
      ...(opts.html !== undefined && { html: opts.html }),
      ...(opts.clearHtml && { html: null }),
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
