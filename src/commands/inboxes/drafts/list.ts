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
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';
import { renderDraftsTable } from './utils';

export const listInboxDraftsCommand = new Command('list')
  .alias('ls')
  .description('List drafts in an inbox')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
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
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","type":"standalone|reply","to":["<address>"]|null,"cc":[],"bcc":[],"subject":"<subject>|null","snippet":"<text>|null","thread_id":"<uuid>|null","reply_to_email_id":"<uuid>|null","attachments":[{"id":"<uuid>","filename":"<name>","content_type":"<type>","size":123}],"updated_at":"<date>"}]}`,
      errorCodes: [
        'auth_error',
        'invalid_limit',
        'invalid_pagination',
        'list_error',
      ],
      examples: [
        'resend inboxes drafts list 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes drafts list 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
        'resend inboxes drafts list 78261eea-8f8b-4381-83c6-79fa7120f1cf --limit 25 --after <draft-id> --json',
      ],
    }),
  )
  .action(async (inboxIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );
    const ids = resolveIdInputs(
      { inbox: [inboxIdArg, opts.inboxId] },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    await runList(
      {
        loading: 'Fetching drafts...',
        sdkCall: (resend) =>
          resend.inboxes.drafts.list({
            ...inboxSelector(inboxId),
            ...paginationOpts,
          }),
        onInteractive: (list) => {
          console.log(renderDraftsTable(list.data));
          printPaginationHint(list, `inboxes drafts list ${inboxId}`, {
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
