import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../../lib/help-text';
import { applyCareerCommand } from './apply';
import { getCareerCommand } from './get';
import { listCareersCommand } from './list';

export const careersCommand = new Command('careers')
  .description('Browse open positions at Resend and apply from your terminal')
  .addHelpText(
    'after',
    buildHelpText({
      context: `Flow: \`resend careers\` lists open positions, \`resend careers get <id>\` shows
a position and its application form fields, and \`resend careers apply\` walks you
through the application (or takes flags for scripted submissions).

Any Resend API key works — applications are not tied to your team.`,
      examples: [
        'resend careers',
        'resend careers get 053bde8f-294e-4cce-9d62-2301282120a2',
        'resend careers apply',
      ],
    }),
  )
  .addCommand(applyCareerCommand)
  .addCommand(getCareerCommand)
  .addCommand(listCareersCommand, { isDefault: true });
