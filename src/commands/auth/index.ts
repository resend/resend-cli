import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { loginCommand } from './login';
import { logoutCommand } from './logout';

export const authCommand = new Command('auth')
  .description('Manage authentication')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      examples: [
        'resend login',
        'resend login --key re_123456789',
        'resend logout',
      ],
    }),
  )
  .addCommand(loginCommand)
  .addCommand(logoutCommand);
