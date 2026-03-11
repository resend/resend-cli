import { Command } from '@commander-js/extra-typings';
import { buildHelpText } from '../lib/help-text';

export const openCommand = new Command('open')
  .description('Open the Resend dashboard in your browser')
  .addHelpText(
    'after',
    buildHelpText({
      context: 'Opens https://resend.com/emails in your default browser.',
      examples: ['resend open'],
    }),
  )
  .action(async () => {
    const url = 'https://resend.com/emails';
    const { platform } = process;
    const cmd =
      platform === 'darwin'
        ? 'open'
        : platform === 'win32'
          ? 'start'
          : 'xdg-open';

    Bun.spawn([cmd, url], { stdio: ['ignore', 'ignore', 'ignore'] });
  });
