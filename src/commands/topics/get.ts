import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { topicPickerConfig } from './utils';

export const getTopicCommand = new Command('get')
  .description('Retrieve a topic by ID')
  .argument('[id]', 'Topic UUID')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"id":"<uuid>","name":"<name>","description":"<desc>","default_subscription":"opt_in|opt_out","created_at":"<iso-date>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend topics get 78261eea-8f8b-4381-83c6-79fa7120f1cf',
        'resend topics get 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, topicPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching topic...',
        sdkCall: (resend) => resend.topics.get(id),
        onInteractive: (data) => {
          console.log(`${data.name}`);
          console.log(`ID: ${data.id}`);
          if (data.description) {
            console.log(`Description: ${data.description}`);
          }
          console.log(`Default subscription: ${data.default_subscription}`);
          console.log(`Created: ${data.created_at}`);
        },
      },
      globalOpts,
    );
  });
