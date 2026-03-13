import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderTemplatesTable } from './utils';

export const listTemplatesCommand = new Command('list')
  .alias('ls')
  .description('List all templates')
  .option('--limit <n>', 'Maximum number of templates to return (1-100)', '10')
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
      output: `  {"object":"list","has_more":false,"data":[{"id":"...","name":"...","status":"draft|published","alias":"...","created_at":"..."}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend templates list',
        'resend templates list --limit 5',
        'resend templates list --after <template-id> --limit 10',
        'resend templates list --json',
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
          loading: 'Fetching templates...',
          success: 'Templates fetched',
          fail: 'Failed to list templates',
        },
        sdkCall: (resend) => resend.templates.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderTemplatesTable(list.data));
          printPaginationHint(list);
        },
      },
      globalOpts,
    );
  });
