import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { applyCareerCommand } from './apply';
import { listCareersCommand } from './list';

export const careersCommand = new Command('careers')
  .description('Browse open positions at Resend and apply from your terminal')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Flow: \`resend careers\` lists open positions, and \`resend careers apply\`
walks you through the application (or takes flags for scripted submissions).

Any Resend API key works — applications are not tied to your team.`,
      examples: ['resend careers', 'resend careers apply'],
    }),
  )
  .addCommand(applyCareerCommand)
  .addCommand(listCareersCommand, { isDefault: true });
