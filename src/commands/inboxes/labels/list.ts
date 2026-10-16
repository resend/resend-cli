import { Command } from '@commander-js/extra-typings';
import { runList } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';
import { renderLabelsTable } from './utils';

export const listInboxLabelsCommand = new Command('list')
  .alias('ls')
  .description('List labels in an inbox')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .addHelpText(
    'after',
    buildHelpText({
      context:
        'Returns all labels in the inbox (not paginated). Use the label IDs with "threads labels add", "threads labels set" and "threads list --labels".',
      output: `  {"object":"list","data":[{"id":"<uuid>","name":"<name>","color":"#RRGGBB","created_at":"<date>"}]}`,
      errorCodes: ['auth_error', 'list_error'],
      examples: [
        'resend inboxes labels list 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend inboxes labels list 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (inboxIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const ids = resolveIdInputs(
      { inbox: [inboxIdArg, opts.inboxId] },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    await runList(
      {
        loading: 'Fetching labels...',
        sdkCall: (resend) => resend.inboxes.labels.list(inboxSelector(inboxId)),
        onInteractive: (list) => console.log(renderLabelsTable(list.data)),
      },
      globalOpts,
    );
  });
