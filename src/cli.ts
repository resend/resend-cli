#!/usr/bin/env bun
import { Command } from '@commander-js/extra-typings';
import { authCommand } from './commands/auth/index';
import { emailsCommand } from './commands/emails/index';
import { domainsCommand } from './commands/domains/index';
import { apiKeysCommand } from './commands/api-keys/index';
import { broadcastsCommand } from './commands/broadcasts/index';
import { contactsCommand } from './commands/contacts/index';
import { contactPropertiesCommand } from './commands/contact-properties/index';
import { segmentsCommand } from './commands/segments/index';
import { topicsCommand } from './commands/topics/index';
import { webhooksCommand } from './commands/webhooks/index';
import { doctorCommand } from './commands/doctor';
import { setupCommand } from './commands/setup/index';
import { skillsCommand } from './commands/skills/index';
import { VERSION, PACKAGE_NAME } from './lib/version';

const program = new Command()
  .name('resend')
  .description('Resend CLI — email for developers')
  .version(`${PACKAGE_NAME} v${VERSION}`, '-v, --version', 'Output the current version')
  .option('--api-key <key>', 'Resend API key (overrides env/config)')
  .option('--json', 'Force JSON output')
  .configureHelp({ showGlobalOptions: true })
  .addHelpText('after', `
Environment:
  RESEND_API_KEY    API key — checked after --api-key, before stored credentials
                    Priority: --api-key flag > RESEND_API_KEY > ~/.config/resend/credentials.json

Output:
  Human-readable by default. Pass --json or pipe stdout for machine-readable JSON.
  Errors always exit with code 1: {"error":{"message":"...","code":"..."}}

Examples:
  $ resend auth login --key re_123456789
  $ resend emails send --from you@domain.com --to user@example.com --subject "Hi" --text "Hello"
  $ resend emails batch --file ./emails.json --json
  $ resend doctor --json`)
  .addCommand(authCommand)
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
  .addCommand(setupCommand)
  .addCommand(skillsCommand);

program.parse();
