#!/usr/bin/env bun
import { Command } from '@commander-js/extra-typings';
import { authCommand } from './commands/auth/index';
import { emailsCommand } from './commands/emails/index';
import { doctorCommand } from './commands/doctor';
import { VERSION } from './lib/version';

const program = new Command()
  .name('resend')
  .description('Resend CLI — email for developers')
  .version(VERSION)
  .option('--api-key <key>', 'Resend API key (overrides env/config)')
  .option('--json', 'Force JSON output')
  .configureHelp({ showGlobalOptions: true })
  .addCommand(authCommand)
  .addCommand(emailsCommand)
  .addCommand(doctorCommand);

program.parse();
