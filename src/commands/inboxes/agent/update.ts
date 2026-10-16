import { Command } from '@commander-js/extra-typings';
import {
  INBOX_AGENT_ACTIONS,
  INBOX_AGENT_TONES,
  type InboxAgentAction,
  type InboxAgentTone,
  type UpdateInboxAgentOptions,
} from 'resend';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';

export const updateInboxAgentCommand = new Command('update')
  .description("Update an inbox's agent instructions, tone, or actions")
  .argument('[inboxId]', 'Inbox UUID or email address')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .option(
    '--instructions <text>',
    'Instructions the agent follows (max 4000 characters)',
  )
  .option(
    '--tone <tone>',
    `Tone preset the agent writes in: ${INBOX_AGENT_TONES.join(', ')}`,
  )
  .option(
    '--actions <actions...>',
    `Replace the actions the agent can take (comma or space-separated): ${INBOX_AGENT_ACTIONS.join(', ')}`,
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --instructions, --tone, or --actions is required.
Omitted fields keep their current value.
--tone takes one of the presets ${INBOX_AGENT_TONES.join(', ')}.
Pass --instructions "" or --tone "" to clear the value.
--actions replaces the whole set. Duplicates are removed. Pass --actions "" to disable all actions.`,
      output: `  {"object":"inbox_agent","id":"<uuid>"}`,
      errorCodes: [
        'auth_error',
        'no_changes',
        'invalid_tone',
        'invalid_actions',
        'update_error',
      ],
      examples: [
        'resend inboxes agent update <inbox-id> --instructions "Answer refund questions yourself."',
        'resend inboxes agent update <inbox-id> --actions draft_reply add_labels archive --json',
        'resend inboxes agent update <inbox-id> --tone concise_professional',
        'resend inboxes agent update <inbox-id> --tone ""',
      ],
    }),
  )
  .action(async (inboxIdArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (
      opts.instructions === undefined &&
      opts.tone === undefined &&
      opts.actions === undefined
    ) {
      outputError(
        {
          message:
            'Provide at least one option to update: --instructions, --tone, or --actions.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    if (
      opts.tone &&
      !(INBOX_AGENT_TONES as readonly string[]).includes(opts.tone)
    ) {
      outputError(
        {
          message: `Invalid --tone value: ${opts.tone}. Use: ${INBOX_AGENT_TONES.join(', ')}, or "" to clear the tone.`,
          code: 'invalid_tone',
        },
        { json: globalOpts.json },
      );
    }

    const actions = opts.actions && [
      ...new Set(
        opts.actions
          .flatMap((a) => a.split(','))
          .map((a) => a.trim())
          .filter(Boolean),
      ),
    ];
    const invalid = actions?.filter(
      (a) => !(INBOX_AGENT_ACTIONS as readonly string[]).includes(a),
    );
    if (invalid?.length) {
      outputError(
        {
          message: `Invalid --actions value: ${invalid.join(', ')}. Use: ${INBOX_AGENT_ACTIONS.join(', ')}.`,
          code: 'invalid_actions',
        },
        { json: globalOpts.json },
      );
    }

    const ids = resolveIdInputs(
      { inbox: [inboxIdArg, opts.inboxId] },
      globalOpts,
    );
    const inboxId = await pickId(ids.inbox, inboxPickerConfig, globalOpts);

    // The no_changes guard ensures one field is set; tsc cannot prove it.
    const payload = {
      ...inboxSelector(inboxId),
      ...(opts.instructions !== undefined && {
        instructions: opts.instructions || null,
      }),
      ...(opts.tone !== undefined && {
        tone: (opts.tone || null) as InboxAgentTone | null,
      }),
      ...(actions && { actions: actions as InboxAgentAction[] }),
    } as UpdateInboxAgentOptions;

    await runWrite(
      {
        loading: 'Updating agent settings...',
        sdkCall: (resend) => resend.inboxes.agent.update(payload),
        errorCode: 'update_error',
        successMsg: `Agent settings updated for inbox: ${inboxId}`,
      },
      globalOpts,
    );
  });
