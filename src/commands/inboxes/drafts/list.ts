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
import { inboxPickerConfig } from '../utils';
import { renderDraftsTable } from './utils';

export const listInboxDraftsCommand = new Command('list')
  .alias('ls')
  .description('List drafts in an inbox')
  .option('--inbox_id <id>', 'Inbox UUID')
  .option('--limit <n>', 'Maximum number of drafts to return (1-100)', '10')
  .option(
    '--after <cursor>',
    'Cursor for forward pagination — list drafts after this draft ID',
  )
  .option(
    '--before <cursor>',
    'Cursor for backward pagination — list drafts before this draft ID',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Pass the last draft ID of the previous page as --after to fetch the next page.',
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>|null","snippet":"<text>|null","thread_id":"<uuid>|null","reply_to_email_id":"<uuid>|null","updated_at":"<date>"}]}`,
      errorCodes: [
        'auth_error',
        'invalid_limit',
        'invalid_pagination',
        'list_error',
      ],
      examples: [
        'resend inboxes drafts list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes drafts list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
        'resend inboxes drafts list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --limit 25 --after <draft_id> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );
    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    await runList(
      {
        loading: 'Fetching drafts...',
        sdkCall: (resend) =>
          resend.inboxes.drafts.list({
            inboxId,
            ...paginationOpts,
          }),
        onInteractive: (list) => {
          console.log(renderDraftsTable(list.data));
          printPaginationHint(list, 'inboxes drafts list', {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
            extraFlags: `--inbox_id ${inboxId}`,
          });
        },
      },
      globalOpts,
    );
  });
