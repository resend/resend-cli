import { Command, Option } from '@commander-js/extra-typings';
import * as p from '@clack/prompts';
import type { GlobalOpts } from '../../lib/client';
import { requireClient } from '../../lib/client';
import { cancelAndExit } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult, errorMessage } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

export const createApiKeyCommand = new Command('create')
  .description('Create a new API key and display the token (shown once — store it immediately)')
  .option('--name <name>', 'API key name (max 50 characters)')
  .addOption(
    new Option('--permission <permission>', 'Permission level').choices([
      'full_access',
      'sending_access',
    ] as const)
  )
  .option('--domain-id <id>', 'Restrict a sending_access key to a single domain ID')
  .addHelpText(
    'after',
    `
Non-interactive: --name is required (no prompts when stdin/stdout is not a TTY).

Permissions:
  full_access     Full API access (default)
  sending_access  Send-only access; optionally scope to a domain with --domain-id

Global options (defined on root):
  --api-key <key>  API key (or set RESEND_API_KEY env var)
  --json           Force JSON output (also auto-enabled when stdout is piped)

Output (--json or piped):
  {"id":"<id>","token":"<token>"}
  The token is only returned at creation time and cannot be retrieved again.

Errors (exit code 1):
  {"error":{"message":"<message>","code":"<code>"}}
  Codes: auth_error | missing_name | create_error

Examples:
  $ resend api-keys create --name "Production"
  $ resend api-keys create --name "CI Token" --permission sending_access
  $ resend api-keys create --name "Domain Token" --permission sending_access --domain-id <domain-id>
  $ resend api-keys create --name "Production" --json`
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;

    const resend = requireClient(globalOpts);

    let name = opts.name;
    let permission = opts.permission;

    if (!name) {
      if (!isInteractive()) {
        outputError({ message: 'Missing --name flag.', code: 'missing_name' }, { json: globalOpts.json });
      }

      const nameResult = await p.text({
        message: 'Key name',
        placeholder: 'My API Key',
        validate: (v) => {
          if (!v) return 'Name is required';
          if (v.length > 50) return 'Name must be 50 characters or less';
          return undefined;
        },
      });
      if (p.isCancel(nameResult)) cancelAndExit('Cancelled.');
      name = nameResult;

      const permissionResult = await p.select({
        message: 'Permission level',
        options: [
          { value: 'full_access' as const, label: 'Full access' },
          { value: 'sending_access' as const, label: 'Sending access only' },
        ],
      });
      if (p.isCancel(permissionResult)) cancelAndExit('Cancelled.');
      permission = permissionResult;
    }

    const spinner = createSpinner('Creating API key...');

    try {
      const { data, error } = await resend.apiKeys.create({
        name,
        ...(permission && { permission }),
        ...(opts.domainId && { domain_id: opts.domainId }),
      });

      if (error) {
        spinner.fail('Failed to create API key');
        outputError({ message: error.message, code: 'create_error' }, { json: globalOpts.json });
      }

      spinner.stop('API key created');

      const d = data!;
      if (!globalOpts.json && isInteractive()) {
        console.log('\nAPI key created!\n');
        console.log(`  Name:    ${name}`);
        console.log(`  ID:      ${d.id}`);
        console.log(`  Token:   ${d.token}`);
        console.log('\n⚠  Store this token now — it cannot be retrieved again.');
      } else {
        outputResult(d, { json: globalOpts.json });
      }
    } catch (err) {
      spinner.fail('Failed to create API key');
      outputError(
        { message: errorMessage(err, 'Unknown error'), code: 'create_error' },
        { json: globalOpts.json }
      );
    }
  });
