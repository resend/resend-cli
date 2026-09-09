import { Command } from '@commander-js/extra-typings';
import type { CreateWebhookResponse } from 'resend';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { webhookPickerConfig } from './utils';

export const rotateWebhookSigningSecretCommand = new Command(
  'rotate-signing-secret',
)
  .description('Generate a new signing secret for a webhook')
  .argument('[id]', 'Webhook UUID')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Generates a new signing secret and returns it. Payloads delivered after the
rotation are signed with the new secret, so update your verification code with it.

The signing_secret in the response is shown ONCE — save it immediately.`,
      output: `  {"object":"webhook","id":"<uuid>","signing_secret":"<whsec_...>"}`,
      errorCodes: ['auth_error', 'create_error'],
      examples: [
        'resend webhooks rotate-signing-secret 4dd369bc-aa82-4ff3-97de-514ae3000ee0',
        'resend webhooks rotate-signing-secret 4dd369bc-aa82-4ff3-97de-514ae3000ee0 --json',
      ],
    }),
  )
  .action(async (idArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, webhookPickerConfig, globalOpts);

    await runCreate(
      {
        loading: 'Rotating webhook signing secret...',
        sdkCall: (resend) =>
          (
            resend.webhooks as unknown as {
              rotateSigningSecret: (
                id: string,
              ) => Promise<CreateWebhookResponse>;
            }
          ).rotateSigningSecret(id),
        onInteractive: (d) => {
          console.log(`Webhook signing secret rotated`);
          console.log(`ID:             ${d.id}`);
          console.log(`Signing Secret: ${d.signing_secret}`);
          console.log(`Save the signing secret — it is only shown once.`);
        },
      },
      globalOpts,
    );
  });
