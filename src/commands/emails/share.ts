import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { pickId } from '../../lib/prompts';
import { emailPickerConfig } from './utils';

export const shareCommand = new Command('share')
  .description('Create a shareable link for a sent or received email')
  .argument('[id]', 'Email ID')
  .option(
    '--expires-in <duration>',
    'Link expiration, e.g. "10m", "2 hours", "1 day" (max 48h, default 48h)',
  )
  .addHelpText(
    'after',
    buildHelpText({
      output: '  {"object":"email","id":"<email-id>","url":"<share-link-url>"}',
      errorCodes: ['auth_error', 'create_error'],
      examples: [
        'resend emails share <email-id>',
        'resend emails share <email-id> --expires-in "1 day"',
        'resend emails share <email-id> --json',
      ],
    }),
  )
  .action(async (idArg, opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const id = await pickId(idArg, emailPickerConfig, globalOpts);
    await runCreate(
      {
        loading: 'Creating share link...',
        sdkCall: (resend) =>
          resend.emails.share(
            id,
            opts.expiresIn ? { expiresIn: opts.expiresIn } : undefined,
          ),
        onInteractive: (d) => {
          console.log(`  ${pc.gray('ID:')}   ${d.id}`);
          console.log(`  ${pc.gray('URL:')}  ${d.url}`);
        },
      },
      globalOpts,
    );
  });
