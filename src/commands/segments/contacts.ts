import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { pickId } from '../../lib/prompts';
import { renderContactsTable } from '../contacts/utils';
import { segmentPickerConfig } from './utils';

export const segmentContactsCommand = new Command('contacts')
  .description('List contacts belonging to a segment')
  .argument('[segmentId]', 'ID of the segment')
  .option('--limit <n>', 'Maximum number of contacts to return (1-100)', '10')
  .option('--after <cursor>', 'Return contacts after this cursor (next page)')
  .option(
    '--before <cursor>',
    'Return contacts before this cursor (previous page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Lists all contacts that belong to the given segment.

If no segment ID is provided interactively, a picker will prompt you to choose one.

Pagination: use --after or --before with a contact ID as the cursor.
  Only one of --after or --before may be used at a time.
  The response includes has_more: true when additional pages exist.`,
      output: `  {"object":"list","data":[{"id":"...","email":"...","first_name":"...","last_name":"...","unsubscribed":false}],"has_more":false}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend segments contacts 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend segments contacts 78261eea-8f8b-4381-83c6-79fa7120f1cf --limit 25 --json',
        'resend segments contacts 78261eea-8f8b-4381-83c6-79fa7120f1cf --after 479e3145-dd38-4932-8c0c-e58b548c9e76',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const segmentId = await pickId(idArg, segmentPickerConfig, globalOpts);
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );
    await runList(
      {
        loading: 'Fetching segment contacts...',
        sdkCall: (resend) =>
          resend.contacts.list({ segmentId, ...paginationOpts }),
        onInteractive: (list) => {
          console.log(renderContactsTable(list.data));
          printPaginationHint(list, `segments contacts ${segmentId}`, {
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
