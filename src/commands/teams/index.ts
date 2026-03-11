import { Command } from '@commander-js/extra-typings';
import { listCommand } from './list';
import { removeCommand } from './remove';
import { switchCommand } from './switch';

export const teamsCommand = new Command('teams')
  .description('Manage team profiles for multiple API keys')
  .addCommand(listCommand)
  .addCommand(switchCommand)
  .addCommand(removeCommand);
