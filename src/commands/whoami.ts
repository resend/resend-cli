import { join } from 'node:path';
import { Command } from '@commander-js/extra-typings';
import type { GlobalOpts } from '../lib/client';
import {
  type ApiKeyPermission,
  type ApiKeySource,
  getConfigDir,
  listProfiles,
  maskKey,
  resolveAuthentication,
  resolveProfileName,
} from '../lib/config';
import { buildHelpText } from '../lib/help-text';
import { outputError, outputResult } from '../lib/output';
import { isInteractive } from '../lib/tty';

const SOURCE_LABELS: Record<ApiKeySource, string> = {
  flag: 'flag',
  env: 'environment variable',
  config: 'config file',
  secure_storage: 'secure storage',
};

const PERMISSION_LABELS: Record<ApiKeyPermission, string> = {
  full_access: 'full access',
  sending_access: 'sending access',
};

export const whoamiCommand = new Command('whoami')
  .description('Show current authentication status')
  .addHelpText(
    'after',
    buildHelpText({
      setup: true,
      context: `Local only — no network calls.
Shows which profile is active and where the active credential comes from.`,
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
    const profileFlag = globalOpts.profile;
    const resolved = await resolveAuthentication(
      globalOpts.apiKey,
      profileFlag,
      { refresh: false },
    );

    if (!resolved) {
      const requestedProfile = profileFlag
        ? profileFlag
        : resolveProfileName(profileFlag);
      const profiles = listProfiles();
      const profileExists = profiles.some((p) => p.name === requestedProfile);
      const explicitProfile = profileFlag || process.env.RESEND_PROFILE;

      const message =
        explicitProfile && !profileExists
          ? `Profile "${requestedProfile}" not found.\nAvailable profiles: ${profiles.map((p) => p.name).join(', ') || '(none)'}`
          : 'Not authenticated.\nRun `resend login` to get started.';
      const code =
        explicitProfile && !profileExists
          ? 'profile_not_found'
          : 'not_authenticated';

      if (globalOpts.json || !isInteractive()) {
        outputError({ message, code }, { json: globalOpts.json });
      } else {
        outputError({ message, code }, { json: false });
      }
    }

    const profile = resolved.profile ?? resolveProfileName(profileFlag);
    const configPath = join(getConfigDir(), 'credentials.json');
    const token =
      resolved.type === 'api_key' ? resolved.key : resolved.access_token;
    const source = resolved.source;
    const permission =
      resolved.type === 'api_key' ? resolved.permission : undefined;

    if (globalOpts.json || !isInteractive()) {
      outputResult(
        {
          authenticated: true,
          profile,
          api_key: maskKey(token),
          source,
          ...(permission && { permission }),
          config_path: configPath,
        },
        { json: globalOpts.json },
      );
      return;
    }

    const sourceLabel =
      resolved.type === 'oauth_grant'
        ? `${SOURCE_LABELS[source]} (oauth)`
        : SOURCE_LABELS[source];

    const permissionLabel = permission
      ? PERMISSION_LABELS[permission]
      : undefined;

    console.log('');
    console.log(`  Profile: ${profile}`);
    console.log(
      resolved.type === 'oauth_grant'
        ? `  Token:   ${maskKey(token)}`
        : `  API Key: ${maskKey(token)}`,
    );
    console.log(`  Source:  ${sourceLabel}`);
    if (permissionLabel) {
      console.log(`  Access:  ${permissionLabel}`);
    }
    console.log(`  Config:  ${configPath}`);
    console.log('');
  });
