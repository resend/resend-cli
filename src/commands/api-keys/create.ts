import * as p from '@clack/prompts';
import { Command, Option } from '@commander-js/extra-typings';
import pc from 'picocolors';
import { runCreate } from '../../lib/actions';
import type { GlobalOpts } from '../../lib/client';
import { buildHelpText } from '../../lib/help-text';
import { outputError } from '../../lib/output';
import { cancelAndExit } from '../../lib/prompts';
import { isInteractive } from '../../lib/tty';

export const createApiKeyCommand = new Command('create')
  .description(
    'Create a new API key and display the token (shown once — store it immediately)',
  )
  .option('--name <name>', 'API key name (max 50 characters)')
  .addOption(
    new Option('--permission <permission>', 'Permission level').choices([
      'full_access',
      'sending_access',
    ] as const),
  )
  .option(
    '--domain-id <id>',
    'Restrict a sending_access key to a single domain ID',
  )
  .addHelpText(
    'after',
    buildHelpText({
      context: `Non-interactive: --name is required (no prompts when stdin/stdout is not a TTY).

Permissions:
  full_access     Full API access (default)
  sending_access  Send-only access; optionally scope to a domain with --domain-id`,
      output: `  {"id":"<id>","token":"<token>"}
  The token is only returned at creation time and cannot be retrieved again.`,
      errorCodes: ['auth_error', 'missing_name', 'create_error'],
      examples: [
        'resend api-keys create --name "Production"',
        'resend api-keys create --name "CI Token" --permission sending_access',
        'resend api-keys create --name "Domain Token" --permission sending_access --domain-id <domain-id>',
        'resend api-keys create --name "Production" --json',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    let name = opts.name;
    let permission = opts.permission;

    if (!name) {
      if (!isInteractive()) {
        outputError(
          { message: 'Missing --name flag.', code: 'missing_name' },
          { json: globalOpts.json },
        );
      }

      const nameResult = await p.text({
        message: 'Key name',
        placeholder: 'My API Key',
        validate: (v) => {
          if (!v) {
            return 'Name is required';
          }
          if (v.length > 50) {
            return 'Name must be 50 characters or less';
          }
          return undefined;
        },
      });
      if (p.isCancel(nameResult)) {
        cancelAndExit('Cancelled.');
      }
      name = nameResult;

      const permissionResult = await p.select({
        message: 'Permission level',
        options: [
          { value: 'full_access' as const, label: 'Full access' },
          { value: 'sending_access' as const, label: 'Sending access only' },
        ],
      });
      if (p.isCancel(permissionResult)) {
        cancelAndExit('Cancelled.');
      }
      permission = permissionResult;
    }

    await runCreate(
      {
        spinner: {
          loading: 'Creating API key...',
          success: 'API key created',
          fail: 'Failed to create API key',
        },
        sdkCall: (resend) =>
          resend.apiKeys.create({
            name,
            ...(permission && { permission }),
            ...(opts.domainId && { domain_id: opts.domainId }),
          }),
        onInteractive: (d) => {
          console.log(`\n  ${pc.gray('Name:')}    ${name}`);
          console.log(`  ${pc.gray('ID:')}      ${d.id}`);
          console.log(`  ${pc.gray('Token:')}   ${d.token}`);
          console.log(
            `\n${pc.yellow('⚠')}  Store this token now — it cannot be retrieved again.`,
          );
        },
      },
      globalOpts,
    );
  });
