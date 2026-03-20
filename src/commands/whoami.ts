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
  {"authenticated":false}`,
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

      // If a specific profile was requested but doesn't exist, show a targeted error
      const message =
        explicitProfile && !profileExists
          ? `Profile "${requestedProfile}" not found.\nAvailable profiles: ${profiles.map((p) => p.name).join(', ') || '(none)'}`
          : 'Not authenticated.\nRun `resend login` to get started.';
      const code =
        explicitProfile && !profileExists
          ? 'profile_not_found'
          : 'not_authenticated';

      if (globalOpts.json || !isInteractive()) {
        outputResult(
          {
            authenticated: false,
            ...(explicitProfile && !profileExists
              ? { profile: requestedProfile }
              : {}),
          },
          { json: globalOpts.json, exitCode: 1 },
        );
        // outputResult with exitCode calls process.exit, but TS doesn't know
        return;
      }
      outputError({ message, code }, { json: false });
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

    console.log('');
    console.log(`  Profile: ${profile}`);
    console.log(`  API Key: ${maskKey(resolved.key)}`);
    console.log(`  Source:  ${sourceLabel}`);
    console.log(`  Config:  ${configPath}`);
    console.log('');
  });
