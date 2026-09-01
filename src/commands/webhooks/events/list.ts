import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { parseLimitOpt, printPaginationHint } from '../../../lib/pagination';
import { pickId } from '../../../lib/prompts';
import { webhookPickerConfig } from '../utils';
import { renderWebhookEventsTable } from './utils';

export const listWebhookEventsCommand = new Command('list')
  .alias('ls')
  .description('List the events delivered to a webhook, most recent first')
  .argument('[webhookId]', 'Webhook ID')
  .option('--limit <n>', 'Maximum number of events to return (1-100)', '10')
  .option('--after <cursor>', 'Return events after this event ID (next page)')
  .addHelpText(
    'after',
    buildHelpText({
      context: `status is the delivery status of the event to this webhook:
pending, attempting, success, or failed.

This endpoint paginates forward only — there is no --before cursor.`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"msg_...","type":"email.sent","created_at":"...","status":"success"}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend webhooks events list 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend webhooks events list 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --limit 50',
        'resend webhooks events list 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --after msg_1srOrx2ZWZBpBUvZwXKQmoEYga2',
        'resend webhooks events list 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json',
      ],
    }),
  )
  .action(async (webhookIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const webhookId = await pickId(
      webhookIdArg,
      webhookPickerConfig,
      globalOpts,
    );
    const limit = parseLimitOpt(opts.limit, globalOpts);

    await runList(
      {
        loading: 'Fetching webhook events...',
        sdkCall: (resend) =>
          resend.webhooks.events.list({
            webhookId,
            limit,
            ...(opts.after && { after: opts.after }),
          }),
        onInteractive: (list) => {
          console.log(renderWebhookEventsTable(list.data));
          printPaginationHint(list, `webhooks events list ${webhookId}`, {
            limit,
            apiKey: globalOpts.apiKey,
            profile: globalOpts.profile,
          });
        },
      },
      globalOpts,
    );
  });
