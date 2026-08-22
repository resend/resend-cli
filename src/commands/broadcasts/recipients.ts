import { Command, Option } from '@commander-js/extra-typings';
import { runList } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import {
  buildPaginationOpts,
  parseLimitOpt,
  printPaginationHint,
} from '../../lib/pagination';
import { pickId, requireSelect } from '../../lib/prompts';
import { broadcastPickerConfig, renderBroadcastRecipientsTable } from './utils';

const EVENT_TYPES = [
  'sent',
  'delivered',
  'opened',
  'clicked',
  'bounced',
  'complained',
  'unsubscribed',
  'suppressed',
] as const;

export const recipientsBroadcastCommand = new Command('recipients')
  .description("List a broadcast's recipients for a given event type")
  .argument('[id]', 'Broadcast ID')
  .addOption(
    new Option('--type <type>', 'Event type to filter recipients by').choices(
      EVENT_TYPES,
    ),
  )
  .option(
    '--email <email>',
    'Filter recipients whose email contains this value',
  )
  .addOption(
    new Option(
      '--bounce-type <type>',
      'Filter by bounce classification — only meaningful when --type is bounced',
    ).choices(['permanent', 'transient', 'undetermined'] as const),
  )
  .option('--limit <n>', 'Maximum number of recipients to return (1-100)', '20')
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
      context: `Non-interactive: --type is required.
Note: responses are cached for up to 15 minutes, so requesting the same page
again may return slightly stale data within that window.
--bounce-type only has an effect when --type is bounced.`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"<cursor>","contact_id":"<id>|null","email":"...","count":3,"clicked_links":[{"url":"...","clicks":2}]}]}`,
      errorCodes: [
        'auth_error',
        'missing_type',
        'invalid_limit',
        'invalid_pagination',
        'list_error',
      ],
      examples: [
        'resend broadcasts recipients d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --type opened',
        'resend broadcasts recipients d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --type clicked --limit 50',
        'resend broadcasts recipients d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --type bounced --bounce-type permanent',
        'resend broadcasts recipients d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --type sent --email @example.com --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, broadcastPickerConfig, globalOpts);
    const type = await requireSelect(
      opts.type,
      {
        message: 'Event type',
        options: EVENT_TYPES.map((t) => ({ value: t, label: t })),
      },
      { message: 'Missing --type flag.', code: 'missing_type' },
      globalOpts,
    );
    const limit = parseLimitOpt(opts.limit, globalOpts);
    const paginationOpts = buildPaginationOpts(
      limit,
      opts.after,
      opts.before,
      globalOpts,
    );

    await runList(
      {
        loading: 'Fetching recipients...',
        sdkCall: (resend) =>
          resend.broadcasts.recipients(id, {
            type,
            ...paginationOpts,
            ...(opts.email && { email: opts.email }),
            ...(opts.bounceType && { bounceType: opts.bounceType }),
          }),
        onInteractive: (list) => {
          console.log(renderBroadcastRecipientsTable(list.data));
          printPaginationHint(list, `broadcasts recipients ${id}`, {
            limit,
            before: opts.before,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
            extraFlags: [
              `--type ${type}`,
              opts.email && `--email ${opts.email}`,
              opts.bounceType && `--bounce-type ${opts.bounceType}`,
            ]
              .filter(Boolean)
              .join(' '),
          });
        },
      },
      globalOpts,
    );
  });
