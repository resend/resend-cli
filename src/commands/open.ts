import { spawn } from 'node:child_process';
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
    const args =
      platform === 'darwin'
        ? ['open', url]
        : platform === 'win32'
          ? ['cmd', '/c', 'start', url]
          : ['xdg-open', url];

    spawn(args[0], args.slice(1), { stdio: 'ignore', detached: true })
      .on('error', () => {})
      .unref();
  });
