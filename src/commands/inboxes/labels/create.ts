import { Command, Option } from '@commander-js/extra-typings';
import { runCreate } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId, requireText } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';
import { parseLabelColor } from './utils';

export const createInboxLabelCommand = new Command('create')
  .description('Create a label in an inbox')
  .argument('[inboxId]', 'Inbox UUID or email address')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--name <name>', 'Label name (required, max 64 characters)')
  .addOption(
    new Option(
      '--color <color>',
      'Label color as a hex code like #E93D82 (random when omitted)',
    ).argParser(parseLabelColor),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `An inbox can have up to 100 labels. Label names are unique per inbox,
compared without case. The color is stored in uppercase.

Non-interactive: --name is required.`,
      output: `  {"object":"inbox_label","id":"<uuid>"}`,
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend inboxes labels create <inbox-id> --name "Billing"',
        'resend inboxes labels create <inbox-id> --name "Urgent" --color \'#E93D82\' --json',
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

    const name = await requireText(
      opts.name,
      { message: 'Label name', placeholder: 'e.g. Billing' },
      { message: 'Missing --name flag.', code: 'missing_name' },
      globalOpts,
    );

    await runCreate(
      {
        loading: 'Creating label...',
        sdkCall: (resend) =>
          resend.inboxes.labels.create({
            ...inboxSelector(inboxId),
            name,
            ...(opts.color && { color: opts.color }),
          }),
        onInteractive: (data) => {
          console.log(`Label created: ${data.id}`);
        },
      },
      globalOpts,
    );
  });
