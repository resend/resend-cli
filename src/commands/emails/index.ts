import { Command } from '@commander-js/extra-typings';
import { sendCommand } from './send';

export const emailsCommand = new Command('emails')
  .description('Send and manage emails')
  .addCommand(sendCommand);
