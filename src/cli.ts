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
import { printBannerPlain } from './lib/logo';
import { errorMessage, outputError } from './lib/output';
import { trackCommand } from './lib/telemetry';
import { checkForUpdates } from './lib/update-check';
import { PACKAGE_NAME, VERSION } from './lib/version';

setupCliExitHandler();

let lastCommandName = '';
let lastFlags: string[] = [];
let lastGlobalFlags: string[] = [];

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
    const parts: string[] = [];
    for (
      let cmd = actionCommand;
      cmd?.parent;
      cmd = cmd.parent as typeof actionCommand
    ) {
      parts.unshift(cmd.name());
    }
    lastCommandName = parts.join(' ');

    const extractFlags = (cmd: typeof actionCommand) =>
      cmd.options
        .filter(
          (opt) => cmd.getOptionValueSource(opt.attributeName()) === 'cli',
        )
        .map(
          (opt) =>
            opt.long?.replace(/^--/, '') ?? opt.short?.replace(/^-/, '') ?? '',
        )
        .filter(Boolean);

    lastFlags = extractFlags(actionCommand);
    lastGlobalFlags = extractFlags(thisCommand);

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
${pc.gray('Examples:')}

- Login to Resend

  ${pc.blue('$ resend login')}

- Send an email

  ${pc.blue('$ resend emails send')}
`,
  )
  .action(() => {
    if (process.stdout.isTTY) {
      printBannerPlain();
    }
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
  .addCommand(emailsCommand)
  .addCommand(broadcastsCommand)
  .addCommand(templatesCommand)
  .addCommand(contactsCommand)
  .addCommand(contactPropertiesCommand)
  .addCommand(segmentsCommand)
  .addCommand(topicsCommand)
  .addCommand(domainsCommand)
  .addCommand(apiKeysCommand)
  .addCommand(webhooksCommand)
  .addCommand(authCommand)
  .addCommand(logoutCommand)
  .addCommand(whoamiCommand)
  .addCommand(doctorCommand)
  .addCommand(openCommand)
  .addCommand(updateCommand)
  .addCommand(teamsDeprecatedCommand);

const telemetryCommand = new Command('telemetry')
  .description('Telemetry management')
  .helpCommand(false);

telemetryCommand
  .command('flush')
  .argument('<file>')
  .action(async (file) => {
    const { flushFromFile } = await import('./lib/telemetry');
    await flushFromFile(file);
  });

program.addCommand(telemetryCommand, { hidden: true });

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
    if (ran === 'update' || ran === 'telemetry') {
      return;
    }

    if (lastCommandName) {
      trackCommand(lastCommandName, {
        ...program.opts(),
        flags: lastFlags,
        globalFlags: lastGlobalFlags,
      });
    }

    return checkForUpdates().catch(() => {});
  })
  .catch((err) => {
    outputError({
      message: errorMessage(err, 'An unexpected error occurred'),
      code: 'unexpected_error',
    });
  });
