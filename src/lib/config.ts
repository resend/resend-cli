import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type ApiKeySource = 'flag' | 'env' | 'config';
export type ResolvedKey = {
  key: string;
  source: ApiKeySource;
  profile?: string;
};

export type Profile = { api_key: string };
export type CredentialsFile = {
  active_profile: string;
  profiles: Record<string, Profile>;
};

/** @deprecated Use `Profile` instead */
export type TeamProfile = Profile;

export function getConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, 'resend');
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'resend');
  }
  return join(homedir(), '.config', 'resend');
}

function getCredentialsPath(): string {
  return join(getConfigDir(), 'credentials.json');
}

export function readCredentials(): CredentialsFile | null {
  try {
    const data = JSON.parse(readFileSync(getCredentialsPath(), 'utf-8'));
    // Support legacy format: { api_key: "re_xxx" }
    if (data.api_key && !data.profiles && !data.teams) {
      return {
        active_profile: 'default',
        profiles: { default: { api_key: data.api_key } },
      };
    }
    // New format: { profiles, active_profile }
    if (data.profiles) {
      return {
        active_profile: data.active_profile ?? 'default',
        profiles: data.profiles,
      };
    }
    // Old format: { teams, active_team }
    if (data.teams) {
      return {
        active_profile: data.active_team ?? 'default',
        profiles: data.teams,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCredentials(creds: CredentialsFile): string {
  const configDir = getConfigDir();
  mkdirSync(configDir, { recursive: true, mode: 0o700 });

  const configPath = getCredentialsPath();
  writeFileSync(configPath, `${JSON.stringify(creds, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(configPath, 0o600);

  return configPath;
}

export function resolveProfileName(flagValue?: string): string {
  if (flagValue) {
    return flagValue;
  }

  // Check RESEND_PROFILE first, fall back to deprecated RESEND_TEAM
  const envProfile = process.env.RESEND_PROFILE || process.env.RESEND_TEAM;
  if (envProfile) {
    return envProfile;
  }

  const creds = readCredentials();
  if (creds?.active_profile) {
    return creds.active_profile;
  }

  return 'default';
}

/** @deprecated Use `resolveProfileName` instead */
export const resolveTeamName = resolveProfileName;

export function resolveApiKey(
  flagValue?: string,
  profileName?: string,
): ResolvedKey | null {
  if (flagValue) {
    return { key: flagValue, source: 'flag' };
  }

  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env' };
  }

  const creds = readCredentials();
  if (creds) {
    const profile = resolveProfileName(profileName);
    const entry = creds.profiles[profile];
    if (entry?.api_key) {
      return { key: entry.api_key, source: 'config', profile };
    }
  }

  return null;
}

export function storeApiKey(apiKey: string, profileName?: string): string {
  const profile = profileName || 'default';
  const validationError = validateProfileName(profile);
  if (validationError) {
    throw new Error(validationError);
  }
  const creds = readCredentials() || {
    active_profile: 'default',
    profiles: {},
  };

  creds.profiles[profile] = { api_key: apiKey };

  // If this is the first profile, set it as active
  if (Object.keys(creds.profiles).length === 1) {
    creds.active_profile = profile;
  }

  return writeCredentials(creds);
}

export function removeAllApiKeys(): string {
  const configPath = getCredentialsPath();
  unlinkSync(configPath);
  return configPath;
}

export function removeApiKey(profileName?: string): string {
  const creds = readCredentials();
  if (!creds) {
    const configPath = getCredentialsPath();
    if (!existsSync(configPath)) {
      throw new Error('No credentials file found.');
    }
    // Try to delete legacy file
    unlinkSync(configPath);
    return configPath;
  }

  const profile = profileName || resolveProfileName();
  if (!creds.profiles[profile]) {
    throw new Error(
      `Profile "${profile}" not found. Available profiles: ${Object.keys(creds.profiles).join(', ')}`,
    );
  }
  delete creds.profiles[profile];

  // If we removed the active profile, switch to first available or "default"
  if (creds.active_profile === profile) {
    const remaining = Object.keys(creds.profiles);
    creds.active_profile = remaining[0] || 'default';
  }

  // If no profiles left, delete the file
  if (Object.keys(creds.profiles).length === 0) {
    const configPath = getCredentialsPath();
    unlinkSync(configPath);
    return configPath;
  }

  return writeCredentials(creds);
}

export function setActiveProfile(profileName: string): void {
  const validationError = validateProfileName(profileName);
  if (validationError) {
    throw new Error(validationError);
  }
  const creds = readCredentials();
  if (!creds) {
    throw new Error('No credentials file found. Run: resend login');
  }
  if (!creds.profiles[profileName]) {
    throw new Error(
      `Profile "${profileName}" not found. Available profiles: ${Object.keys(creds.profiles).join(', ')}`,
    );
  }
  creds.active_profile = profileName;
  writeCredentials(creds);
}

/** @deprecated Use `setActiveProfile` instead */
export const setActiveTeam = setActiveProfile;

export function listProfiles(): Array<{ name: string; active: boolean }> {
  const creds = readCredentials();
  if (!creds) {
    return [];
  }
  return Object.keys(creds.profiles).map((name) => ({
    name,
    active: name === creds.active_profile,
  }));
}

/** @deprecated Use `listProfiles` instead */
export const listTeams = listProfiles;

export function validateProfileName(name: string): string | undefined {
  if (!name || name.length === 0) {
    return 'Profile name must not be empty';
  }
  if (name.length > 64) {
    return 'Profile name must be 64 characters or fewer';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return 'Profile name must contain only letters, numbers, dashes, and underscores';
  }
  return undefined;
}

/** @deprecated Use `validateProfileName` instead */
export const validateTeamName = validateProfileName;

export function maskKey(key: string): string {
  if (key.length <= 7) {
    return `${key.slice(0, 3)}...`;
  }
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}
