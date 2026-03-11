#!/usr/bin/env bun
import { Command } from '@commander-js/extra-typings';
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
import { checkForUpdates } from './lib/update-check';
import { PACKAGE_NAME, VERSION } from './lib/version';

const BANNER = `
██████╗ ███████╗███████╗███████╗███╗   ██╗██████╗
██╔══██╗██╔════╝██╔════╝██╔════╝████╗  ██║██╔══██╗
██████╔╝█████╗  ███████╗█████╗  ██╔██╗ ██║██║  ██║
██╔══██╗██╔══╝  ╚════██║██╔══╝  ██║╚██╗██║██║  ██║
██║  ██║███████╗███████║███████╗██║ ╚████║██████╔╝
╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝╚═════╝
`;

const program = new Command()
  .name('resend')
  .description('Resend CLI — email for developers')
  .addHelpText('beforeAll', BANNER)
  .version(
    `${PACKAGE_NAME} v${VERSION}`,
    '-v, --version',
    'Output the current version',
  )
  .option('--api-key <key>', 'Resend API key (overrides env/config)')
  .option('--team <name>', 'Team profile to use (overrides RESEND_TEAM)')
  .option('--json', 'Force JSON output')
  .option('-q, --quiet', 'Suppress spinners and status output (implies --json)')
  .configureHelp({ showGlobalOptions: true })
  .hook('preAction', (thisCommand, actionCommand) => {
    if (actionCommand.optsWithGlobals().quiet) {
      thisCommand.setOptionValue('json', true);
    }
  })
  .addHelpText(
    'after',
    `
Environment:
  RESEND_API_KEY    API key — checked after --api-key, before stored credentials
                    Priority: --api-key flag > RESEND_API_KEY > ~/.config/resend/credentials.json
  RESEND_TEAM       Team profile — checked after --team flag, before active_team in config
                    Priority: --team flag > RESEND_TEAM > active_team in config > "default"

Output:
  Human-readable by default. Pass --json or pipe stdout for machine-readable JSON.
  Use --quiet (-q) in CI to suppress spinners and status messages (implies --json).
  Errors always exit with code 1: {"error":{"message":"...","code":"..."}}

Examples:
  $ resend login
  $ resend emails send`,
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
  .then(() => checkForUpdates())
  .catch(() => {});
