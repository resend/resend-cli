import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../../lib/actions';
import type { GlobalOpts } from '../../../lib/client';
import { buildHelpText } from '../../../lib/help-text';
import { pickId } from '../../../lib/prompts';
import { inboxPickerConfig } from '../utils';

export const getInboxAgentCommand = new Command('get')
  .description("Retrieve an inbox's agent settings")
  .option('--inbox_id <id>', 'Inbox UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context: 'An inbox without a configured agent returns empty settings.',
      output: `  {"object":"inbox_agent","instructions":"<text>|null","tone":"<tone>|null","enabled_actions":["draft_reply"]}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend inboxes agent get --inbox_id <inbox_id>',
        'resend inboxes agent get --inbox_id <inbox_id> --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const inboxId = await pickId(opts.inbox_id, inboxPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching agent settings...',
        sdkCall: (resend) => resend.inboxes.agent.get({ inboxId }),
        onInteractive: (data) => {
          console.log(`Instructions: ${data.instructions || '(none)'}`);
          console.log(`Tone: ${data.tone || '(none)'}`);
          console.log(
            `Enabled actions: ${data.enabled_actions.join(', ') || '(none)'}`,
          );
        },
      },
      globalOpts,
    );
  });
