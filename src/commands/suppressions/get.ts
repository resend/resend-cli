import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { suppressionPickerConfig } from './utils';

export const getSuppressionCommand = new Command('get')
  .description('Retrieve a suppression by ID or email address')
  .argument('[id-or-email]', 'Suppression ID or the suppressed email address')
  .addHelpText(
    'after',
    buildHelpText({
      output: `  {"object":"suppression","id":"<id>","email":"<email>","origin":"bounce|complaint|manual","source_id":"<id>|null","created_at":"<date>"}`,
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend suppressions get spam@example.com',
        'resend suppressions get 78261eea-8f8b-4381-83c6-79fa7120f1cf --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const idOrEmail = await pickId(idArg, suppressionPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching suppression...',
        sdkCall: (resend) => resend.suppressions.get(idOrEmail),
        onInteractive: (data) => {
          console.log(`${data.email}`);
          console.log(`ID: ${data.id}`);
          console.log(`Origin: ${data.origin}`);
          if (data.source_id) {
            console.log(`Source: ${data.source_id}`);
          }
          console.log(`Created: ${data.created_at}`);
        },
      },
      globalOpts,
    );
  });
