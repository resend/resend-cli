#!/usr/bin/env bun
import { Command } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { apiKeysCommand } from './commands/api-keys/index';
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
import { teamsCommand } from './commands/teams/index';
import { topicsCommand } from './commands/topics/index';
import { webhooksCommand } from './commands/webhooks/index';
import { whoamiCommand } from './commands/whoami';
import { errorMessage, outputError } from './lib/output';
import { checkForUpdates } from './lib/update-check';
import { PACKAGE_NAME, VERSION } from './lib/version';

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
  .option('--team <name>', 'Team profile to use (overrides RESEND_TEAM)')
  .option('--json', 'Force JSON output')
  .option('-q, --quiet', 'Suppress spinners and status output (implies --json)')
  .hook('preAction', (thisCommand, actionCommand) => {
    if (actionCommand.optsWithGlobals().quiet) {
      thisCommand.setOptionValue('json', true);
    }
  })
  .addHelpText(
    'after',
    `
${pc.gray('Environment:')}
  RESEND_API_KEY    API key — checked after --api-key, before stored credentials
                    Priority: --api-key flag > RESEND_API_KEY > ~/.config/resend/credentials.json
  RESEND_TEAM       Team profile — checked after --team flag, before active_team in config
                    Priority: --team flag > RESEND_TEAM > active_team in config > "default"

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
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(emailsCommand)
  .addCommand(domainsCommand)
  .addCommand(apiKeysCommand)
  .addCommand(broadcastsCommand)
  .addCommand(contactsCommand)
  .addCommand(contactPropertiesCommand)
  .addCommand(segmentsCommand)
  .addCommand(topicsCommand)
  .addCommand(webhooksCommand)
  .addCommand(doctorCommand)
  .addCommand(teamsCommand)
  .addCommand(openCommand)
  .addCommand(whoamiCommand);

program
  .parseAsync()
  .then(() => checkForUpdates().catch(() => {}))
  .catch((err) => {
    outputError({
      message: errorMessage(err, 'An unexpected error occurred'),
      code: 'unexpected_error',
    });
  });
