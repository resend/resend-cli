import { Command, Option } from '@commander-js/extra-typings';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, resolveIdInputs } from '../utils';
import { inboxLabelPickerConfig, parseLabelColor } from './utils';

export const updateInboxLabelCommand = new Command('update')
  .description("Update a label's name or color")
  .argument('[inboxId]', 'Inbox UUID')
  .argument('[labelId]', 'Label UUID')
  .option('--inbox-id <id>', 'Inbox UUID')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option('--label-id <id>', 'Label UUID')
  .addOption(snakeCaseAlias('--label-id <id>'))
  .option('--name <name>', 'New label name (max 64 characters)')
  .addOption(
    new Option(
      '--color <color>',
      'New label color as a hex code like #E93D82',
    ).argParser(parseLabelColor),
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: 'At least one of --name or --color must be provided.',
      output: `  {"object":"inbox_label","id":"<uuid>"}`,
      errorCodes: ['auth_error', 'no_changes', 'update_error'],
      examples: [
        'resend inboxes labels update <inbox-id> <label-id> --name "Billing"',
        "resend inboxes labels update <inbox-id> <label-id> --color '#12A594' --json",
      ],
    }),
  )
  .action(async (inboxIdArg, labelIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (opts.name === undefined && opts.color === undefined) {
      outputError(
        {
          message: 'Provide at least one option to update: --name or --color.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const ids = resolveIdInputs(
      {
        inbox: [inboxIdArg, opts.inboxId],
        label: [labelIdArg, opts.labelId],
      },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);
    const labelId = await pickId(
      ids.label,
      inboxLabelPickerConfig(inboxId),
      globalOpts,
    );

    await runWrite(
      {
        loading: 'Updating label...',
        sdkCall: (resend) =>
          resend.inboxes.labels.update({
            inboxId,
            labelId,
            ...(opts.name !== undefined && { name: opts.name }),
            ...(opts.color !== undefined && { color: opts.color }),
          }),
        errorCode: 'update_error',
        successMsg: `Label updated: ${labelId}`,
      },
      globalOpts,
    );
  });
