import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { snakeCaseAlias } from '../../../lib/snake-case-alias';
import { inboxPickerConfig, inboxSelector, resolveIdInputs } from '../utils';

export const getInboxAgentCommand = new Command('get')
  .description("Retrieve an inbox's agent settings")
  .argument('[inboxId]', 'Inbox UUID or email address')
  .option('--inbox-id <id>', 'Inbox UUID or email address')
  .addOption(snakeCaseAlias('--inbox-id <id>'))
  .addHelpText(
    'after',
    buildHelpText({
      context: 'An inbox without a configured agent returns empty settings.',
      output: `  {"object":"inbox_agent","instructions":"<text>|null","tone":"concise_professional|concise_casual|expanded_professional|expanded_casual|null","actions":["draft_reply"]}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend inboxes agent get <inbox-id>',
        'resend inboxes agent get <inbox-id> --json',
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
    await runGet(
      {
        loading: 'Fetching agent settings...',
        sdkCall: (resend) => resend.inboxes.agent.get(inboxSelector(inboxId)),
        onInteractive: (data) => {
          console.log(`Instructions: ${data.instructions || '(none)'}`);
          console.log(`Tone: ${data.tone || '(none)'}`);
          console.log(`Actions: ${data.actions.join(', ') || '(none)'}`);
        },
      },
      globalOpts,
    );
  });
