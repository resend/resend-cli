import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { requireText } from '../../lib/prompts';

export const addSuppressionCommand = new Command('add')
  .description('Suppress an email address so it stops receiving your emails')
  .argument('[email]', 'Email address to suppress')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: <email> is required (no prompts when stdin/stdout is not a TTY).

A suppressed address is skipped on future sends. Added this way, the entry has
origin "manual". Use "suppressions delete" to remove it again.`,
      output: `  {"object":"suppression","id":"<id>"}`,
      errorCodes: ['auth_error', 'missing_email', 'create_error'],
      examples: [
        'resend suppressions add spam@example.com',
        'resend suppressions add spam@example.com --json',
      ],
    }),
  )
  .action(async (emailArg, _opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const email = await requireText(
      emailArg,
      { message: 'Email to suppress', placeholder: 'e.g. spam@example.com' },
      {
        message: 'Missing <email> argument.',
        code: 'missing_email',
      },
      globalOpts,
    );

    await runCreate(
      {
        loading: 'Suppressing address...',
        sdkCall: (resend) => resend.suppressions.add({ email }),
        onInteractive: (d) => {
          console.log(`  ${pc.gray('Email:')}  ${email}`);
          console.log(`  ${pc.gray('ID:')}     ${d.id}`);
        },
      },
      globalOpts,
    );
  });
