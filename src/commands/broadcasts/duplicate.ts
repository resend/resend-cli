import { Command } from '@commander-js/extra-typings';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { broadcastPickerConfig } from './utils';

export const duplicateBroadcastCommand = new Command('duplicate')
  .description('Duplicate a broadcast')
  .argument('[id]', 'Broadcast ID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Creates a copy of an existing broadcast and returns the new broadcast ID.
The copy is a draft named after the original with " (copy)" appended, truncated to 70 characters.
Segment, topic, from, subject, reply-to, preview text, and content are copied. Any broadcast can be duplicated, including sent ones.`,
      output: `  {"object":"broadcast","id":"<new-broadcast-id>"}`,
      errorCodes: ['auth_error', 'create_error'],
      examples: [
        'resend broadcasts duplicate d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        'resend broadcasts duplicate d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, broadcastPickerConfig, globalOpts);
    await runCreate(
      {
        loading: 'Duplicating broadcast...',
        sdkCall: (resend) => resend.broadcasts.duplicate(id),
        onInteractive: (d) => {
          console.log(`Broadcast duplicated: ${d.id}`);
        },
      },
      globalOpts,
    );
  });
