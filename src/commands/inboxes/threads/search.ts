import { Command, Option } from '@commander-js/extra-typings';
import { INBOX_MESSAGE_FOLDERS } from 'resend';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../../lib/pagination';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { renderThreadsTable, threadFilterFlags, threadFilters } from './utils';

export const searchInboxThreadsCommand = new Command('search')
  .description(
    'Search threads in an inbox by text, people, attachments, and dates',
  )
  .option('--inbox_id <id>', 'Inbox UUID')
  .option(
    '--query <text>',
    'Text to find in the subject, body, sender, recipients, and attachment names. Every word must match. Quote a phrase to match it exactly, prefix a word with - to exclude it',
  )
  .option(
    '--from <addresses...>',
    'Sender addresses or names, one or more, partial match',
  )
  .option(
    '--to <addresses...>',
    'Recipient addresses or names, one or more, partial match',
  )
  .option(
    '--cc <addresses...>',
    'Cc addresses or names, one or more, partial match',
  )
  .option(
    '--bcc <addresses...>',
    'Bcc addresses or names, one or more, partial match',
  )
  .option('--has_attachment', 'Only emails with an attachment')
  .option('--without_attachment', 'Only emails without an attachment')
  .option(
    '--start_date <date>',
    'Emails sent on or after this date (e.g. 2026-09-01, or an ISO 8601 timestamp)',
  )
  .option(
    '--end_date <date>',
    'Emails sent on or before this date. A date covers the whole day',
  )
  .addOption(
    new Option(
      '--folders <folders...>',
      'Folders to search, one or more (default: inbox, or inbox, archive and sent with --labels)',
    ).choices(INBOX_MESSAGE_FOLDERS),
  )
  .option(
    '--labels <label_ids...>',
    'Label UUIDs, one or more. Returns threads with any of them',
  )
  .option('--read', 'Only threads where every email is read')
  .option('--unread', 'Only threads with at least one unread email')
  .option('--limit <n>', 'Maximum number of threads to return (1-100)', '10')
  .option(
    '--after <cursor>',
    'Cursor for forward pagination — search threads after this thread ID',
  )
  .option(
    '--before <cursor>',
    'Cursor for backward pagination — search threads before this thread ID',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Results are ordered by newest activity first and paginate like
"resend inboxes threads list". Each result names the email that matched
(matched_email_id) and the matching snippets (highlights).

Search can be up to about a minute behind new emails. To browse an inbox
exactly and up to date, use "resend inboxes threads list".`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","subject":"<subject>|null","from":"<sender>|null","to":[],"cc":[],"bcc":[],"labels":[],"message_count":1,"has_attachment":false,"has_draft":false,"read":false,"received_at":"<date>","folder":"inbox|archive|spam|sent|trash","matched_email_id":"<uuid>|null","highlights":{"subject":["<snippet>"]}}]}`,
      errorCodes: [
        'auth_error',
        'invalid_options',
        'invalid_limit',
        'invalid_pagination',
        'list_error',
      ],
      examples: [
        'resend inboxes threads search --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --query invoice',
        'resend inboxes threads search --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --query \'"q3 renewal" -draft\' --json',
        'resend inboxes threads search --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --from isabella@example.com --has_attachment --start_date 2026-09-01 --end_date 2026-09-30 --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    if (opts.has_attachment && opts.without_attachment) {
      outputError(
        {
          message:
            'Use either --has_attachment or --without_attachment, not both.',
          code: 'invalid_options',
        },
        { json: globalOpts.json },
      );
    }
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
        loading: 'Searching threads...',
        sdkCall: (resend) =>
          resend.inboxes.threads.search({
            inboxId,
            ...filters,
            query: opts.query,
            from: opts.from,
            to: opts.to,
            cc: opts.cc,
            bcc: opts.bcc,
            hasAttachment: opts.has_attachment
              ? true
              : opts.without_attachment
                ? false
                : undefined,
            startDate: opts.start_date,
            endDate: opts.end_date,
            ...paginationOpts,
          }),
        onInteractive: (list) => {
          console.log(renderThreadsTable(list.data));
          printPaginationHint(list, 'inboxes threads search', {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
            extraFlags: [
              `--inbox_id ${inboxId}`,
              opts.query !== undefined &&
                `--query ${JSON.stringify(opts.query)}`,
              opts.from && `--from ${opts.from.join(' ')}`,
              opts.to && `--to ${opts.to.join(' ')}`,
              opts.cc && `--cc ${opts.cc.join(' ')}`,
              opts.bcc && `--bcc ${opts.bcc.join(' ')}`,
              opts.has_attachment && '--has_attachment',
              opts.without_attachment && '--without_attachment',
              opts.start_date && `--start_date ${opts.start_date}`,
              opts.end_date && `--end_date ${opts.end_date}`,
              ...threadFilterFlags(opts),
            ]
              .filter(Boolean)
              .join(' '),
          });
        },
      },
      globalOpts,
    );
  });
