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
import {
  broadcastPickerConfig,
  renderBroadcastClickedLinksTable,
} from './utils';

export const clickedLinksBroadcastCommand = new Command('clicked-links')
  .description('List the links clicked in a broadcast, ranked by total clicks')
  .argument('[id]', 'Broadcast ID')
  .option('--limit <n>', 'Maximum number of results to return (1-100)', '10')
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
      output: `  {"object":"list","has_more":false,"data":[{"id":"...","url":"...","clicks":42,"unique_clicks":30}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend broadcasts clicked-links d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts clicked-links d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --limit 5',
        'resend broadcasts clicked-links d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --after b2Zmc2V0OjA',
        'resend broadcasts clicked-links d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, broadcastPickerConfig, globalOpts);
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );
    await runList(
      {
        loading: 'Fetching clicked links...',
        sdkCall: (resend) => resend.broadcasts.clickedLinks(id, paginationOpts),
        onInteractive: (list) => {
          console.log(renderBroadcastClickedLinksTable(list.data));
          printPaginationHint(list, `broadcasts clicked-links ${id}`, {
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
