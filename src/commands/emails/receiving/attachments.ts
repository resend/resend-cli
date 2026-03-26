import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../../lib/pagination';
import { pickId } from '../../../lib/prompts';
import { receivedEmailPickerConfig, renderAttachmentsTable } from './utils';

export const listAttachmentsCommand = new Command('attachments')
  .description('List attachments on a received (inbound) email')
  .argument('[emailId]', 'Received email UUID')
  .option(
    '--limit <n>',
    'Maximum number of attachments to return (1-100)',
    '10',
  )
  .option(
    '--after <cursor>',
    'Return attachments after this cursor (next page)',
  )
  .option(
    '--before <cursor>',
    'Return attachments before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Each attachment has a download_url (signed, expires ~1 hour).\nUse the attachment sub-command to retrieve a single attachment with its download URL:\n  resend emails receiving attachment <emailId> <attachmentId>\n\ncontent_disposition: "inline" means the attachment is embedded in the HTML body (e.g. an image).\ncontent_disposition: "attachment" means it is a standalone file download.',
      output:
        '  {"object":"list","has_more":false,"data":[{"id":"<uuid>","filename":"invoice.pdf","size":51200,"content_type":"application/pdf","content_disposition":"attachment","content_id":null,"download_url":"<url>","expires_at":"<iso-date>"}]}',
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend emails receiving attachments <email-id>',
        'resend emails receiving attachments <email-id> --json',
        'resend emails receiving attachments <email-id> --limit 25 --json',
      ],
    }),
  )
  .action(async (emailIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const emailId = await pickId(
      emailIdArg,
      receivedEmailPickerConfig,
      globalOpts,
    );

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );

    await runList(
      {
        spinner: {
          loading: 'Fetching attachments...',
          success: 'Attachments fetched',
          fail: 'Failed to list attachments',
        },
        sdkCall: (resend) =>
          resend.emails.receiving.attachments.list({
            emailId,
            ...paginationOpts,
          }),
        onInteractive: (list) => {
          console.log(renderAttachmentsTable(list.data));
          printPaginationHint(list, `emails receiving attachments ${emailId}`, {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
          });
        },
      },
      globalOpts,
    );
  });
