import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderTable } from '../../lib/table';

type SentEmail = {
  id: string;
  to: string[];
  from: string;
  created_at: string;
  subject: string;
  last_event: string | null;
  scheduled_at: string | null;
};

function renderSentEmailsTable(emails: SentEmail[]): string {
  const rows = emails.map((e) => {
    const to = e.to.join(', ');
    const toStr = to.length > 40 ? `${to.slice(0, 37)}...` : to;
    const subject =
      e.subject.length > 50 ? `${e.subject.slice(0, 47)}...` : e.subject;
    return [e.from, toStr, subject, e.last_event ?? '—', e.created_at, e.id];
  });
  return renderTable(
    ['From', 'To', 'Subject', 'Status', 'Created', 'ID'],
    rows,
    '(no sent emails)',
  );
}

export const listEmailsCommand = new Command('list')
  .alias('ls')
  .description(
    'List sent emails — returns summary (use "get <id>" for full details)',
  )
  .option('--limit <n>', 'Maximum number of emails to return (1-100)', '10')
  .option(
    '--after <cursor>',
    'Cursor for forward pagination — list items after this ID',
  )
  .option(
    '--before <cursor>',
    'Cursor for backward pagination — list items before this ID',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Lists emails sent by your team. For emails received by your domain, use: resend emails receiving list`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"...","to":["..."],"from":"...","subject":"...","created_at":"...","last_event":"delivered|opened|...","scheduled_at":null}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend emails list',
        'resend emails list --limit 5',
        'resend emails list --after <email-id> --limit 10',
        'resend emails list --json',
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
    await runList(
      {
        spinner: {
          loading: 'Fetching sent emails...',
          success: 'Sent emails fetched',
          fail: 'Failed to list emails',
        },
        sdkCall: (resend) => resend.emails.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderSentEmailsTable(list.data));
          printPaginationHint(list, 'emails list', {
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
