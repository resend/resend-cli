import { Command } from '@commander-js/extra-typings';
import { execFile } from 'node:child_process';
import * as p from '@clack/prompts';
import { Resend } from 'resend';
import { resolveApiKey, storeApiKey } from '../../lib/config';
import { createSpinner } from '../../lib/spinner';
import { outputError, outputResult } from '../../lib/output';
import { isInteractive } from '../../lib/tty';

const RESEND_API_KEYS_URL = 'https://resend.com/api-keys';

function openInBrowser(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    // `start` on Windows is a shell built-in, not an executable.
    // Must invoke via `cmd.exe /c start <url>`.
    const cmd = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
    execFile(cmd, args, (err) => resolve(!err));
  });
}

export const loginCommand = new Command('login')
  .description('Authenticate with your Resend API key')
  .option('--key <key>', 'API key (required in non-interactive mode)')
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as { json?: boolean };
    let apiKey = opts.key;

    if (!apiKey) {
      if (!isInteractive()) {
        outputError(
          { message: 'Missing --key flag. Provide your API key in non-interactive mode.', code: 'missing_key' },
          { json: globalOpts.json }
        );
      }

      p.intro('Resend Authentication');

      const existing = resolveApiKey();
      if (existing) {
        p.log.info(`Existing API key found (source: ${existing.source}). Enter a new key to replace it.`);
      } else {
        const shouldOpen = await p.confirm({
          message: 'No API key found. Open Resend dashboard to create one?',
        });

        if (p.isCancel(shouldOpen)) {
          p.cancel('Login cancelled.');
          process.exit(0);
        }

        if (shouldOpen) {
          const opened = await openInBrowser(RESEND_API_KEYS_URL);
          if (opened) {
            p.log.info(`Opened ${RESEND_API_KEYS_URL}`);
          } else {
            p.log.warn(`Could not open browser. Visit ${RESEND_API_KEYS_URL} manually.`);
          }
        }
      }

      const result = await p.password({
        message: 'Enter your Resend API key:',
        validate: (value) => {
          if (!value) return 'API key is required';
          if (!value.startsWith('re_')) return 'API key must start with re_';
          return undefined;
        },
      });

      if (p.isCancel(result)) {
        p.cancel('Login cancelled.');
        process.exit(0);
      }

      apiKey = result;
    }

    if (!apiKey.startsWith('re_')) {
      outputError(
        { message: 'Invalid API key format. Key must start with re_', code: 'invalid_key_format' },
        { json: globalOpts.json }
      );
      return;
    }

    const spinner = createSpinner('Validating API key...', 'braille');

    try {
      const resend = new Resend(apiKey);
      await resend.domains.list();
      spinner.stop('API key is valid');
    } catch (err) {
      spinner.fail('API key validation failed');
      outputError(
        { message: err instanceof Error ? err.message : 'Failed to validate API key', code: 'validation_failed' },
        { json: globalOpts.json }
      );
      return;
    }

    const configPath = storeApiKey(apiKey);

    if (globalOpts.json) {
      outputResult({ success: true, config_path: configPath }, { json: true });
    } else {
      if (isInteractive()) {
        p.outro(`API key stored at ${configPath}`);
      } else {
        console.log(`API key stored at ${configPath}`);
      }
    }
  });
