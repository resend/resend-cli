import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { createApiKeyCommand } from './create';
import { deleteApiKeyCommand } from './delete';
import { listApiKeysCommand } from './list';

export const apiKeysCommand = new Command('api-keys')
  .description('Manage API keys for authentication')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Security notes:
  - Tokens are only shown at creation time and cannot be retrieved again.
  - Use sending_access keys with --domain-id for per-domain CI tokens.
  - Deleting a key is immediate — any service using it loses access instantly.`,
      examples: [
        'resend api-keys list',
        'resend api-keys create --name "Production"',
        'resend api-keys create --name "CI Token" --permission sending_access --domain-id <domain-id>',
        'resend api-keys delete <id> --yes',
      ],
    }),
  )
  .addCommand(createApiKeyCommand)
  .addCommand(listApiKeysCommand, { isDefault: true })
  .addCommand(deleteApiKeyCommand);
