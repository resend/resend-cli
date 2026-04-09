import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../lib/client';
import {
  getConfigDir,
  listProfiles,
  maskKey,
  resolveApiKeyAsync,
  resolveProfileName,
} from '../lib/config';
import { buildHelpText } from '../lib/help-text';
import { outputError, outputResult } from '../lib/output';
import { isInteractive } from '../lib/tty';

export const whoamiCommand = new Command('whoami')
  .description('Show current authentication status')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Local only — no network calls.
Shows which profile is active and where the API key comes from.`,
      output: `  {"authenticated":true,"profile":"production","api_key":"re_...abcd","source":"config","config_path":"/Users/you/.config/resend/credentials.json"}
  {"error":{"message":"Not authenticated.\\nRun \`resend login\` to get started.","code":"not_authenticated"}}`,
      examples: [
        'resend whoami',
        'resend whoami --json',
        'resend whoami --profile production',
      ],
    }),
  )
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals() as GlobalOpts;
    const profileFlag = globalOpts.profile ?? globalOpts.team;
    const resolved = await resolveApiKeyAsync(globalOpts.apiKey, profileFlag);

    if (!resolved) {
      const requestedProfile = profileFlag
        ? profileFlag
        : resolveProfileName(profileFlag);
      const profiles = listProfiles();
      const profileExists = profiles.some((p) => p.name === requestedProfile);
      const explicitProfile =
        profileFlag || process.env.RESEND_PROFILE || process.env.RESEND_TEAM;

      const message =
        explicitProfile && !profileExists
          ? `Profile "${requestedProfile}" not found.\nAvailable profiles: ${profiles.map((p) => p.name).join(', ') || '(none)'}`
          : 'Not authenticated.\nRun `resend login` to get started.';
      const code =
        explicitProfile && !profileExists
          ? 'profile_not_found'
          : 'not_authenticated';

      outputError({ message, code }, { json: globalOpts.json });
      return;
    }

    const profile = resolved.profile ?? resolveProfileName(profileFlag);
    const configPath = join(getConfigDir(), 'credentials.json');

    if (globalOpts.json || !isInteractive()) {
      outputResult(
        {
          authenticated: true,
          profile,
          api_key: maskKey(resolved.key),
          source: resolved.source,
          ...(resolved.permission && { permission: resolved.permission }),
          config_path: configPath,
        },
        { json: globalOpts.json },
      );
      return;
    }

    const sourceLabel =
      resolved.source === 'secure_storage'
        ? 'secure storage'
        : resolved.source === 'config'
          ? 'config file'
          : resolved.source === 'env'
            ? 'environment variable'
            : 'flag';

    const permissionLabel =
      resolved.permission === 'sending_access'
        ? 'sending access'
        : resolved.permission === 'full_access'
          ? 'full access'
          : undefined;

    console.log('');
    console.log(`  Profile: ${profile}`);
    console.log(`  API Key: ${maskKey(resolved.key)}`);
    console.log(`  Source:  ${sourceLabel}`);
    if (permissionLabel) {
      console.log(`  Access:  ${permissionLabel}`);
    }
    console.log(`  Config:  ${configPath}`);
    console.log('');
  });
