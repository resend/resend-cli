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
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';
import {
  renderThreadSearchTable,
  threadFilterFlags,
  threadFilters,
} from './utils';

const shellQuote = (value: string) =>
  /^[\w@.+:,=/-]+$/.test(value) ? value : `'${value.replace(/'/g, `'\\''`)}'`;

export const searchInboxThreadsCommand = new Command('search')
  .description(
    'Search threads in an inbox by text, people, attachments, and dates',
  )
  .argument('[inboxId]', 'Inbox UUID or email address')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
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
  .option('--has-attachment', 'Only emails with an attachment')
  .addOption(snakeCaseAlias('--has-attachment'))
  .option('--without-attachment', 'Only emails without an attachment')
  .addOption(snakeCaseAlias('--without-attachment'))
  .option(
    '--start-date <date>',
    'Emails sent on or after this date (e.g. 2026-09-01, or an ISO 8601 timestamp)',
  )
  .addOption(snakeCaseAlias('--start-date <date>'))
  .option(
    '--end-date <date>',
    'Emails sent on or before this date. A date covers the whole day',
  )
  .addOption(snakeCaseAlias('--end-date <date>'))
  .addOption(
    new Option(
      '--folders <folders...>',
      'Folders to search, one or more (default: inbox, or inbox, archive and sent with --labels)',
    ).choices(INBOX_MESSAGE_FOLDERS),
  )
  .option(
    '--labels <label-ids...>',
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
(matched_email_id). It is the email ID that "threads emails list" returns,
so pass it to "threads emails get", "reply" and "forward".

Different flags combine, so a thread must match all of them. --folders,
--labels, --read and --unread apply to the thread. The other filters must all
match the same email in the thread. When any of these email filters is set,
the matching email must itself be in one of --folders. For "sent", that means
an email the inbox sent.
When more than 10,000 threads match, search covers the 10,000 with the newest
matching email.

Search can be up to about a minute behind new emails. To browse an inbox
exactly and up to date, use "resend inboxes threads list".`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","subject":"<subject>|null","from":"<sender>|null","to":[],"cc":[],"bcc":[],"labels":[],"email_count":1,"has_attachment":false,"has_draft":false,"read":false,"received_at":"<date>","folder":"inbox|archive|spam|sent|trash","matched_email_id":"<uuid>|null"}]}`,
      errorCodes: [
        'auth_error',
        'invalid_options',
        'invalid_limit',
        'invalid_pagination',
        'list_error',
      ],
      examples: [
        'resend inboxes threads search 78261eea-8f8b-4381-83c6-79fa7120f1cf --query invoice',
        'resend inboxes threads search 78261eea-8f8b-4381-83c6-79fa7120f1cf --query \'"q3 renewal" -draft\' --json',
        'resend inboxes threads search 78261eea-8f8b-4381-83c6-79fa7120f1cf --from isabella@example.com --has-attachment --start-date 2026-09-01 --end-date 2026-09-30 --json',
      ],
    }),
  )
  .action(async (inboxIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    if (opts.hasAttachment && opts.withoutAttachment) {
      outputError(
        {
          message:
            'Use either --has-attachment or --without-attachment, not both.',
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
    const ids = resolveIdInputs(
      { inbox: [inboxIdArg, opts.inboxId] },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    await runList(
      {
        loading: 'Searching threads...',
        sdkCall: (resend) =>
          resend.inboxes.threads.search({
            ...inboxSelector(inboxId),
            ...filters,
            query: opts.query,
            from: opts.from,
            to: opts.to,
            cc: opts.cc,
            bcc: opts.bcc,
            hasAttachment: opts.hasAttachment
              ? true
              : opts.withoutAttachment
                ? false
                : undefined,
            startDate: opts.startDate,
            endDate: opts.endDate,
            ...paginationOpts,
          }),
        onInteractive: (list) => {
          console.log(renderThreadSearchTable(list.data));
          printPaginationHint(list, `inboxes threads search ${inboxId}`, {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
            extraFlags: [
              opts.query !== undefined && `--query ${shellQuote(opts.query)}`,
              opts.from && `--from ${opts.from.map(shellQuote).join(' ')}`,
              opts.to && `--to ${opts.to.map(shellQuote).join(' ')}`,
              opts.cc && `--cc ${opts.cc.map(shellQuote).join(' ')}`,
              opts.bcc && `--bcc ${opts.bcc.map(shellQuote).join(' ')}`,
              opts.hasAttachment && '--has-attachment',
              opts.withoutAttachment && '--without-attachment',
              opts.startDate !== undefined &&
                `--start-date ${shellQuote(opts.startDate)}`,
              opts.endDate !== undefined &&
                `--end-date ${shellQuote(opts.endDate)}`,
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
