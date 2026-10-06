import { Command } from '@commander-js/extra-typings';
import {
  INBOX_AGENT_ACTIONS,
  type InboxAgentAction,
  type UpdateInboxAgentOptions,
} from 'resend';
import { runWrite } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { outputError } from '../../../lib/output';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';

export const updateInboxAgentCommand = new Command('update')
  .description("Update an inbox's agent instructions, tone, or enabled actions")
  .option('--inbox_id <id>', 'Inbox UUID')
  .option(
    '--instructions <text>',
    'Instructions the agent follows (max 4000 characters)',
  )
  .option(
    '--tone <tone>',
    'Tone the agent writes in, e.g. "friendly and concise" (max 64 characters)',
  )
  .option(
    '--enabled_actions <actions...>',
    `Replace the enabled actions (comma or space-separated): ${INBOX_AGENT_ACTIONS.join(', ')}`,
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `At least one of --instructions, --tone, or --enabled_actions is required.
Omitted fields keep their current value.
Pass --instructions "" or --tone "" to clear the value.
--enabled_actions replaces the whole set. Pass --enabled_actions "" to disable all actions.`,
      output: `  {"object":"inbox_agent","id":"<uuid>"}`,
      errorCodes: [
        'auth_error',
        'no_changes',
        'invalid_enabled_actions',
        'update_error',
      ],
      examples: [
        'resend inboxes agent update --inbox_id <inbox_id> --instructions "Answer refund questions yourself."',
        'resend inboxes agent update --inbox_id <inbox_id> --enabled_actions draft_reply add_labels --json',
        'resend inboxes agent update --inbox_id <inbox_id> --tone ""',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    if (
      opts.instructions === undefined &&
      opts.tone === undefined &&
      opts.enabled_actions === undefined
    ) {
      outputError(
        {
          message:
            'Provide at least one option to update: --instructions, --tone, or --enabled_actions.',
          code: 'no_changes',
        },
        { json: globalOpts.json },
      );
    }

    const enabledActions = opts.enabled_actions
      ?.flatMap((a) => a.split(','))
      .map((a) => a.trim())
      .filter(Boolean);
    const invalid = enabledActions?.filter(
      (a) => !(INBOX_AGENT_ACTIONS as readonly string[]).includes(a),
    );
    if (invalid?.length) {
      outputError(
        {
          message: `Invalid --enabled_actions value: ${invalid.join(', ')}. Use: ${INBOX_AGENT_ACTIONS.join(', ')}.`,
          code: 'invalid_enabled_actions',
        },
        { json: globalOpts.json },
      );
    }

    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);

    // The no_changes guard ensures one field is set; tsc cannot prove it.
    const payload = {
      inboxId,
      ...(opts.instructions !== undefined && {
        instructions: opts.instructions || null,
      }),
      ...(opts.tone !== undefined && { tone: opts.tone || null }),
      ...(enabledActions && {
        enabledActions: enabledActions as InboxAgentAction[],
      }),
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
