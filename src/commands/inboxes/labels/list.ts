import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';
import { renderLabelsTable } from './utils';

export const listInboxLabelsCommand = new Command('list')
  .alias('ls')
  .description('List labels in an inbox')
  .option('--inbox_id <id>', 'Inbox UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Returns all labels in the inbox (not paginated). Use the label IDs with "threads update --label_id" and "threads list --label".',
      output: `  {"object":"list","has_more":false,"data":[{"id":"<uuid>","name":"<name>","color":"cyan|teal|grass|lime|yellow|orange|iris|plum|crimson|bronze|mauve","created_at":"<date>"}]}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend inboxes labels list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes labels list --inbox_id 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    await runList(
      {
        loading: 'Fetching labels...',
        sdkCall: (resend) => resend.inboxes.labels.list({ inboxId }),
        onInteractive: (list) => console.log(renderLabelsTable(list.data)),
      },
      globalOpts,
    );
  });
