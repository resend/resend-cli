import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { listCommand } from './list';
import { loginCommand } from './login';
import { logoutCommand } from './logout';
import { removeCommand } from './remove';
import { switchCommand } from './switch';

export const authCommand = new Command('auth')
  .description('Manage authentication and profiles')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      examples: [
        'resend login',
        'resend login --key re_123456789',
        'resend logout',
        'resend auth list',
        'resend auth switch staging',
        'resend auth remove staging',
      ],
    }),
  )
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(listCommand, { isDefault: true })
  .addCommand(switchCommand)
  .addCommand(removeCommand);
