import { execFile } from 'node:child_process';
import * as p from '@clack/prompts';
import { Command } from '@commander-js/extra-typings';
import { Resend } from 'resend';
import type { GlobalOpts } from '../../lib/client';
import {
  listProfiles,
  resolveApiKeyAsync,
  setActiveProfile,
  storeApiKeyAsync,
  validateProfileName,
} from '../../lib/config';
import { buildHelpText } from '../../lib/help-text';
import { errorMessage, outputError, outputResult } from '../../lib/output';
import { cancelAndExit, promptRenameIfInvalid } from '../../lib/prompts';
import { createSpinner } from '../../lib/spinner';
import { isInteractive } from '../../lib/tty';

const RESEND_API_KEYS_URL = 'https://resend.com/api-keys?new=true';

function openInBrowser(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    // `start` on Windows is a shell built-in, not an executable.
    // Must invoke via `cmd.exe /c start <url>`.
    const cmd =
      process.platform === 'win32'
        ? 'cmd.exe'
        : process.platform === 'darwin'
          ? 'open'
          : 'xdg-open';
    const args =
      process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
    execFile(cmd, args, { timeout: 5000 }, (err) => resolve(!err));
  });
}

export const loginCommand = new Command('login')
  .description('Save a Resend API key')
  .option('--key <key>', 'API key to store (required in non-interactive mode)')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context:
        'Non-interactive: --key is required (no prompts will appear when stdin/stdout is not a TTY).',
      output: `  {"success":true,"config_path":"<path>"}`,
      errorCodes: ['missing_key', 'invalid_key_format', 'validation_failed'],
      examples: [
        'resend login --key re_123456789',
        'resend login                      (interactive — prompts and opens browser)',
        'RESEND_API_KEY=re_123 resend emails send ...  (skip login; use env var directly)',
      ],
    }),
  )
  .action(async (opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    let apiKey = opts.key;

    if (!apiKey) {
      if (!isInteractive() || globalOpts.json) {
        outputError(
          {
            message:
              'Missing --key flag. Provide your API key in non-interactive mode.',
            code: 'missing_key',
          },
          { json: globalOpts.json },
        );
      }

      p.intro('Resend Authentication');

      const existing = await resolveApiKeyAsync();
      if (existing) {
        p.log.info(
          `Existing API key found (source: ${existing.source}). Enter a new key to replace it.`,
        );
      }

      const method = await p.select({
        message: 'How would you like to get your API key?',
        options: [
          {
            value: 'browser' as const,
            label: 'Open resend.com/api-keys in browser',
          },
          { value: 'manual' as const, label: 'Enter API key manually' },
        ],
      });

      if (p.isCancel(method)) {
        cancelAndExit('Login cancelled.');
      }

      if (method === 'browser') {
        const opened = await openInBrowser(RESEND_API_KEYS_URL);
        if (opened) {
          p.log.info(`Opened ${RESEND_API_KEYS_URL}`);
        } else {
          p.log.warn(
            `Could not open browser. Visit ${RESEND_API_KEYS_URL} manually.`,
          );
        }
      }

      const result = await p.password({
        message: 'Enter your Resend API key:',
        validate: (value) => {
          if (!value) {
            return 'API key is required';
          }
          if (!value.startsWith('re_')) {
            return 'API key must start with re_';
          }
          return undefined;
        },
      });

      if (p.isCancel(result)) {
        cancelAndExit('Login cancelled.');
      }

      apiKey = result;
    }

    if (!apiKey.startsWith('re_')) {
      outputError(
        {
          message: 'Invalid API key format. Key must start with re_',
          code: 'invalid_key_format',
        },
        { json: globalOpts.json },
      );
    }

    const spinner = createSpinner('Validating API key...', globalOpts.quiet);

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.domains.list();
      if (error) {
        spinner.fail('API key validation failed');
        outputError(
          {
            message: error.message || 'Failed to validate API key',
            code: 'validation_failed',
          },
          { json: globalOpts.json },
        );
        return;
      }
      spinner.stop('API key is valid');
    } catch (err) {
      spinner.fail('API key validation failed');
      outputError(
        {
          message: errorMessage(err, 'Failed to validate API key'),
          code: 'validation_failed',
        },
        { json: globalOpts.json },
      );
    }

    let profileName = globalOpts.profile ?? globalOpts.team;

    if (profileName) {
      const profileError = validateProfileName(profileName);
      if (profileError) {
        outputError(
          { message: profileError, code: 'invalid_profile_name' },
          { json: globalOpts.json },
        );
        return;
      }
    }

    if (!profileName && isInteractive() && !globalOpts.json) {
      const existingProfiles = listProfiles();
      if (existingProfiles.length > 0) {
        const options = [
          ...existingProfiles.map((t) => ({
            value: t.name,
            label: `${t.name} (overwrite)`,
            hint: validateProfileName(t.name) ? 'invalid name' : undefined,
          })),
          { value: '__new__' as const, label: '+ Create new profile' },
        ];

        const choice = await p.select({
          message: 'Save API key to which profile?',
          options,
        });

        if (p.isCancel(choice)) {
          cancelAndExit('Login cancelled.');
        }

        if (choice === '__new__') {
          const newName = await p.text({
            message: 'Enter a name for the new profile:',
            validate: (v) => validateProfileName(v as string),
          });
          if (p.isCancel(newName)) {
            cancelAndExit('Login cancelled.');
          }
          profileName = newName;
        } else if (validateProfileName(choice)) {
          const renamed = await promptRenameIfInvalid(choice, globalOpts);
          if (!renamed) {
            return;
          }
          profileName = renamed;
        } else {
          profileName = choice;
        }
      } else {
        profileName = 'default';
      }
    }

    const { configPath, backend } = await storeApiKeyAsync(apiKey, profileName);
    const profileLabel = profileName || 'default';

    // Auto-switch to the newly added profile
    if (profileName) {
      try {
        setActiveProfile(profileName);
      } catch (err) {
        outputError(
          {
            message: errorMessage(err, 'Failed to switch profile'),
            code: 'switch_failed',
          },
          { json: globalOpts.json },
        );
      }
    }

    if (globalOpts.json) {
      outputResult(
        {
          success: true,
          config_path: configPath,
          profile: profileLabel,
          storage: backend.name,
        },
        { json: true },
      );
    } else {
      const storageInfo = !backend.isSecure
        ? `at ${configPath}`
        : `in ${backend.name}`;
      const msg = `API key stored for profile '${profileLabel}' ${storageInfo}`;
      if (isInteractive()) {
        p.outro(msg);
      } else {
        console.log(msg);
      }

      if (!backend.isSecure && process.platform === 'linux') {
        const hint =
          'Tip: Install libsecret-tools and a Secret Service provider (e.g. gnome-keyring) to store keys in secure storage instead of a plaintext file.';
        if (isInteractive()) {
          p.log.info(hint);
        } else {
          console.log(hint);
        }
      }
    }
  });
