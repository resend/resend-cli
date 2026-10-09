import { Command, Option } from '@commander-js/extra-typings';
import { INBOX_MESSAGE_FOLDERS } from 'resend';
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
import {
  collectValues,
  renderThreadsTable,
  threadFilterFlags,
  threadFilters,
} from './utils';

export const listInboxThreadsCommand = new Command('list')
  .alias('ls')
  .description('List threads in an inbox')
  .option('--inbox_id <id>', 'Inbox UUID')
  .addOption(
    new Option(
      '--folder <folder...>',
      'Folder to list (default: inbox, or inbox, archive and sent with --label). Repeat the flag for multiple folders',
    ).choices(INBOX_MESSAGE_FOLDERS),
  )
  .option(
    '--label <label_id>',
    'Filter by label UUID (repeat the flag for multiple labels)',
    collectValues,
    [] as string[],
  )
  .option('--read', 'Only threads where every email is read')
  .option('--unread', 'Only threads with at least one unread email')
  .option('--limit <n>', 'Maximum number of threads to return (1-100)', '10')
  .option(
    '--after <cursor>',
    'Cursor for forward pagination — list threads after this thread ID',
  )
  .option(
    '--before <cursor>',
    'Cursor for backward pagination — list threads before this thread ID',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Threads are ordered by newest activity first. Pass the last thread ID of the
previous page as --after to fetch the next page.

--label takes label UUIDs (from "resend inboxes labels list"), not label names.
To find threads by text, people, attachments, or dates, use
"resend inboxes threads search".`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","subject":"<subject>|null","from":"<sender>|null","to":[],"cc":[],"bcc":[],"labels":[],"message_count":1,"has_attachment":false,"has_draft":false,"read":false,"received_at":"<date>","folder":"inbox|archive|spam|sent|trash"}]}`,
      errorCodes: [
        'auth_error',
        'invalid_options',
        'invalid_limit',
        'invalid_pagination',
        'list_error',
      ],
      examples: [
        'resend inboxes threads list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes threads list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --folder inbox --folder archive --json',
        'resend inboxes threads list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --label <label_id> --unread --json',
        'resend inboxes threads list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --limit 25 --after <thread_id> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const filters = threadFilters(opts, globalOpts);
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
        loading: 'Fetching threads...',
        sdkCall: (resend) =>
          resend.inboxes.threads.list({
            inboxId,
            ...filters,
            ...paginationOpts,
          }),
        onInteractive: (list) => {
          console.log(renderThreadsTable(list.data));
          printPaginationHint(list, 'inboxes threads list', {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
            extraFlags: [
              `--inbox_id ${inboxId}`,
              ...threadFilterFlags(opts),
            ].join(' '),
          });
        },
      },
      globalOpts,
    );
  });
