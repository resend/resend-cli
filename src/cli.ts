#!/usr/bin/env node
import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { apiKeysCommand } from './commands/api-keys/index';
import { authCommand } from './commands/auth/index';
import { loginCommand } from './commands/auth/login';
import { logoutCommand } from './commands/auth/logout';
import { broadcastsCommand } from './commands/broadcasts/index';
import { contactPropertiesCommand } from './commands/contact-properties/index';
import { contactsCommand } from './commands/contacts/index';
import { doctorCommand } from './commands/doctor';
import { domainsCommand } from './commands/domains/index';
import { emailsCommand } from './commands/emails/index';
import { openCommand } from './commands/open';
import { segmentsCommand } from './commands/segments/index';
import { teamsDeprecatedCommand } from './commands/teams-deprecated';
import { templatesCommand } from './commands/templates/index';
import { topicsCommand } from './commands/topics/index';
import { updateCommand } from './commands/update';
import { webhooksCommand } from './commands/webhooks/index';
import { whoamiCommand } from './commands/whoami';
import { setupCliExitHandler } from './lib/cli-exit';
import { errorMessage, outputError } from './lib/output';
import { checkForUpdates } from './lib/update-check';
import { PACKAGE_NAME, VERSION } from './lib/version';

setupCliExitHandler();

const program = new Command()
  .name('resend')
  .description('Resend CLI — email for developers')
  .configureHelp({
    showGlobalOptions: true,
    styleTitle: (str) => pc.gray(str),
  })
  .configureOutput({
    writeErr: (str) => {
      process.stderr.write(str.replace(/^error:/, () => pc.red('error:')));
    },
  })
  .version(
    `${PACKAGE_NAME} v${VERSION}`,
    '-v, --version',
    'Output the current version',
  )
  .option('--api-key <key>', 'Resend API key (overrides env/config)')
  .option('-p, --profile <name>', 'Profile to use (overrides RESEND_PROFILE)')
  .option('--team <name>', 'Deprecated: use --profile instead')
  .option('--json', 'Force JSON output')
  .option('-q, --quiet', 'Suppress spinners and status output (implies --json)')
  .option(
    '--insecure-storage',
    'Save API key as plaintext instead of secure storage',
  )
  .hook('preAction', (thisCommand, actionCommand) => {
    if (actionCommand.optsWithGlobals().quiet) {
      thisCommand.setOptionValue('json', true);
    }
    if (actionCommand.optsWithGlobals().insecureStorage) {
      process.env.RESEND_CREDENTIAL_STORE = 'file';
    }
  })
  .addHelpText(
    'after',
    `
${pc.gray('Environment:')}
  RESEND_API_KEY            API key — checked after --api-key, before stored credentials
                            Priority: --api-key flag > RESEND_API_KEY > secure storage/credentials file
  RESEND_PROFILE            Profile — checked after --profile flag, before active_profile in config
                            Priority: --profile flag > RESEND_PROFILE > active_profile in config > "default"
  RESEND_CREDENTIAL_STORE   Force storage method: "secure_storage" (secure) or "file" (plaintext)

${pc.gray('Output:')}
  Human-readable by default. Pass --json or pipe stdout for machine-readable JSON.
  Use --quiet (-q) in CI to suppress spinners and status messages (implies --json).
  Errors always exit with code 1: {"error":{"message":"...","code":"..."}}

${pc.gray('Examples:')}

- Login to Resend

  ${pc.blue('$ resend login')}

- Send an email

  ${pc.blue('$ resend emails send')}
`,
  )
  .action(() => {
    const opts = program.opts();
    if (opts.apiKey) {
      outputError(
        {
          message:
            '--api-key is a per-command override and was not saved. To store your API key, run `resend login`.',
          code: 'missing_command',
        },
        { json: opts.json },
      );
    }
    program.help();
  })
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(emailsCommand)
  .addCommand(domainsCommand)
  .addCommand(apiKeysCommand)
  .addCommand(broadcastsCommand)
  .addCommand(contactsCommand)
  .addCommand(contactPropertiesCommand)
  .addCommand(segmentsCommand)
  .addCommand(templatesCommand)
  .addCommand(topicsCommand)
  .addCommand(webhooksCommand)
  .addCommand(doctorCommand)
  .addCommand(authCommand)
  .addCommand(openCommand)
  .addCommand(whoamiCommand)
  .addCommand(updateCommand)
  .addCommand(teamsDeprecatedCommand);

// Hide the deprecated --team option from help
const teamOption = program.options.find((o) => o.long === '--team');
if (teamOption) {
  teamOption.hidden = true;
}

program
  .parseAsync()
  .then(() => {
    // Skip the background update notice when the user explicitly ran `update`
    const ran = program.args[0];
    if (ran === 'update') {
      return;
    }
    return checkForUpdates().catch(() => {});
  })
  .catch((err) => {
    outputError({
      message: errorMessage(err, 'An unexpected error occurred'),
      code: 'unexpected_error',
    });
  });
