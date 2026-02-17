import { Command } from '@commander-js/extra-typings';
import { loginCommand } from './login';

export const authCommand = new Command('auth')
  .description('Manage authentication')
  .addCommand(loginCommand);
