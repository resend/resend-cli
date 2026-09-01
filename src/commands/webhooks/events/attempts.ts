import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { parseLimitOpt, printPaginationHint } from '../../../lib/pagination';
import { pickId } from '../../../lib/prompts';
import { webhookPickerConfig } from '../utils';
import {
  renderWebhookEventAttemptsTable,
  webhookEventPickerConfig,
} from './utils';

export const listWebhookEventAttemptsCommand = new Command('attempts')
  .description(
    'List the delivery attempts for a webhook event, most recent first',
  )
  .argument('[webhookId]', 'Webhook ID')
  .argument('[eventId]', 'Webhook event ID')
  .option('--limit <n>', 'Maximum number of attempts to return (1-100)', '10')
  .option(
    '--after <cursor>',
    'Return attempts after this attempt ID (next page)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Each attempt records what your endpoint returned: http_status_code and the
response body. Use this to debug why an event ended up in the failed status.

This endpoint paginates forward only — there is no --before cursor.`,
      output: `  {"object":"list","has_more":false,"data":[{"id":"atmpt_...","http_status_code":500,"response":"Internal Server Error","sent_at":"..."}]}`,
      errorCodes: ['auth_error', 'invalid_limit', 'list_error'],
      examples: [
        'resend webhooks events attempts 4dd369bc-aa82-4ff3-97de-514ae3000ee0 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2',
        'resend webhooks events attempts 4dd369bc-aa82-4ff3-97de-514ae3000ee0 msg_1srOrx2ZWZBpBUvZwXKQmoEYga2 --json',
      ],
    }),
  )
  .action(async (webhookIdArg, eventIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const webhookId = await pickId(
      webhookIdArg,
      webhookPickerConfig,
      globalOpts,
    );
    const eventId = await pickId(
      eventIdArg,
      webhookEventPickerConfig(webhookId),
      globalOpts,
    );
    const limit = parseLimitOpt(opts.limit, globalOpts);

    await runList(
      {
        loading: 'Fetching delivery attempts...',
        sdkCall: (resend) =>
          resend.webhooks.events.attempts.list({
            webhookId,
            eventId,
            limit,
            ...(opts.after && { after: opts.after }),
          }),
        onInteractive: (list) => {
          console.log(renderWebhookEventAttemptsTable(list.data));
          printPaginationHint(
            list,
            `webhooks events attempts ${webhookId} ${eventId}`,
            {
              limit,
              apiKey: globalOpts.apiKey,
              profile: globalOpts.profile,
            },
          );
        },
      },
      globalOpts,
    );
  });
