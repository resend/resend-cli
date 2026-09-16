import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { renderDraftsTable } from './utils';

export const listInboxDraftsCommand = new Command('list')
  .alias('ls')
  .description('List drafts in an inbox')
  .argument('[inboxId]', 'Inbox UUID')
  .option('--cursor <cursor>', 'Pagination cursor from a previous response')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Pass next_cursor from the previous response as --cursor to fetch the next page.',
      output: `  {"object":"list","has_more":false,"next_cursor":"<cursor>|null","data":[{"id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>|null","snippet":"<text>|null","thread_id":"<uuid>|null","reply_to_email_id":"<uuid>|null","updated_at":"<date>"}]}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend inboxes drafts list 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes drafts list 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (inboxIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(inboxIdArg, inboxPickerConfig, globalOpts);
    await runList(
      {
        loading: 'Fetching drafts...',
        sdkCall: (resend) =>
          resend.inboxes.drafts.list({
            inboxId,
            ...(opts.cursor && { cursor: opts.cursor }),
          }),
        onInteractive: (list) => {
          console.log(renderDraftsTable(list.data));
          if (list.has_more && list.next_cursor) {
            console.log(
              `\nFetch the next page:\n$ resend inboxes drafts list ${inboxId} --cursor ${list.next_cursor}`,
            );
          }
        },
      },
      globalOpts,
    );
  });
