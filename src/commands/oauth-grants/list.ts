import { Command } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { renderOAuthGrantsTable } from './utils';

export const listOAuthGrantsCommand = new Command('list')
  .alias('ls')
  .description(
    "List OAuth grants for the team (both active and revoked), including each grant's client, scopes, and revocation status",
  )
  .option(
    '--limit <n>',
    'Maximum number of OAuth grants to return (1-100)',
    '10',
  )
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
      output: `  {"object":"list","has_more":false,"data":[{"id":"<id>","client_id":"<id>","scopes":["<scope>"],"resource":"<url>|null","created_at":"<date>","revoked_at":"<date>|null","revoked_reason":"<reason>|null","client":{"name":"<name>","logo_uri":"<url>|null"}}]}
  Revoked grants have non-null revoked_at and revoked_reason.`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend oauth-grants list',
        'resend oauth-grants list --limit 25 --json',
        'resend oauth-grants list --after <cursor> --json',
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
        loading: 'Fetching OAuth grants...',
        sdkCall: (resend) => resend.oauthGrants.list(paginationOpts),
        onInteractive: (list) => {
          console.log(renderOAuthGrantsTable(list.data));
          printPaginationHint(list, 'oauth-grants list', {
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
