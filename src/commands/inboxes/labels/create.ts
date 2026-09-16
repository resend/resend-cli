import { Command, Option } from '@commander-js/extra-typings';
import { INBOX_LABEL_COLORS } from 'resend';
import { runCreate } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId, requireText } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';

export const createInboxLabelCommand = new Command('create')
  .description('Create a label in an inbox')
  .option('--inbox-id <id>', 'Inbox UUID')
  .option('--name <name>', 'Label name (required, max 64 characters)')
  .addOption(
    new Option('--color <color>', 'Label color (random when omitted)').choices(
      INBOX_LABEL_COLORS,
    ),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `An inbox can have up to 100 labels.

Non-interactive: --name is required.`,
      output: `  {"object":"inbox_label","id":"<uuid>","name":"<name>","color":"<color>","created_at":"<date>"}`,
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend inboxes labels create --inbox-id <inboxId> --name "Billing"',
        'resend inboxes labels create --inbox-id <inboxId> --name "Urgent" --color crimson --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inboxId, inboxPickerConfig, globalOpts);

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
            inboxId,
            name,
            ...(opts.color && { color: opts.color }),
          }),
        onInteractive: (data) => {
          console.log(`Label created: ${data.id}`);
          console.log(`Name: ${data.name} (${data.color})`);
        },
      },
      globalOpts,
    );
  });
