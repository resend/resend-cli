import { Command } from '@commander-js/extra-typings';
import { runGet } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { logPickerConfig } from './utils';

export const getLogCommand = new Command('get')
  .description(
    'Retrieve a single API request log with full request/response bodies',
  )
  .argument('[id]', 'Log ID')
  .addHelpText(
    'after',
    buildHelpText({
      output: '  Full log object including request_body and response_body.',
      errorCodes: ['auth_error', 'fetch_error'],
      examples: [
        'resend logs get 3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55',
        'resend logs get 3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, logPickerConfig, globalOpts);
    await runGet(
      {
        loading: 'Fetching log...',
        sdkCall: (resend) => resend.logs.get(id),
        onInteractive: (d) => {
          console.log(`${d.method} ${d.endpoint} — ${d.response_status}`);
          console.log(`ID:         ${d.id}`);
          console.log(`Created:    ${d.created_at}`);
          console.log(`User-Agent: ${d.user_agent ?? '(none)'}`);
          if (d.request_body) {
            console.log(
              `\nRequest Body:\n${JSON.stringify(d.request_body, null, 2)}`,
            );
          }
          if (d.response_body) {
            console.log(
              `\nResponse Body:\n${JSON.stringify(d.response_body, null, 2)}`,
            );
          }
        },
      },
      globalOpts,
    );
  });
