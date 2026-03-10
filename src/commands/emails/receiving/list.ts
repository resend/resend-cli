import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../../lib/pagination';
import { renderReceivingEmailsTable } from './utils';

export const listReceivingCommand = new Command('list')
  .alias('ls')
  .description(
    'List received (inbound) emails for domains with receiving enabled',
  )
  .option('--limit <n>', 'Maximum number of emails to return (1-100)', '10')
  .option('--after <cursor>', 'Return emails after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return emails before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Receiving must be enabled on the domain first:\n  resend domains update <id> --receiving enabled\n\nPagination: use --after or --before with a received email ID as the cursor.\nOnly one of --after or --before may be used at a time.\nThe response includes has_more: true when additional pages exist.',
      output:
        '  {"object":"list","has_more":false,"data":[{"id":"<uuid>","to":["inbox@yourdomain.com"],"from":"sender@external.com","subject":"Hello","created_at":"<iso-date>","message_id":"<str>","bcc":null,"cc":null,"reply_to":null,"attachments":[]}]}',
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend emails receiving list',
        'resend emails receiving list --limit 25 --json',
        'resend emails receiving list --after <email-id> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(limit, opts.after, opts.before);

    await runList(
      {
        spinner: {
          loading: 'Fetching received emails...',
          success: 'Received emails fetched',
          fail: 'Failed to list received emails',
        },
        sdkCall: (resend) => resend.emails.receiving.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderReceivingEmailsTable(list.data));
          printPaginationHint(list);
        },
      },
      globalOpts,
    );
  });
