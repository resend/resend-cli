import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { listCommand } from './list';
import { loginCommand } from './login';
import { logoutCommand } from './logout';
import { removeCommand } from './remove';
import { renameCommand } from './rename';
import { switchCommand } from './switch';

export const authCommand = new Command('auth')
  .description('Manage authentication and profiles')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Environment variables:
  RESEND_API_KEY            API key (overrides stored credentials)
  RESEND_PROFILE            Profile name (overrides config default)
  RESEND_CREDENTIAL_STORE   Storage method: "secure_storage" or "file"`,
      examples: [
        'resend login',
        'resend login --key re_123456789',
        'resend logout',
        'resend auth list',
        'resend auth switch staging',
        'resend auth rename staging production',
        'resend auth remove staging',
      ],
    }),
  )
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(listCommand, { isDefault: true })
  .addCommand(switchCommand)
  .addCommand(renameCommand)
  .addCommand(removeCommand);
