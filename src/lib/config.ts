import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CorruptedCredentialsError } from './corrupted-credentials-error';
import {
  type CredentialBackend,
  getCredentialBackend,
  SERVICE_NAME,
} from './credential-store';
import { withFileLock } from './file-lock';
import { writeFileAtomic } from './write-file-atomic';

export type ApiKeyPermission = 'full_access' | 'sending_access';

export const SENDING_KEY_MESSAGE =
  'Sending-only keys work with: emails send, emails batch, broadcasts send.\nCreate a full access key at https://resend.com/api-keys';
export type ApiKeySource = 'flag' | 'env' | 'config' | 'secure_storage';
export type ResolvedKey = {
  key: string;
  source: ApiKeySource;
  profile?: string;
  permission?: ApiKeyPermission;
};

export type Profile = { api_key?: string; permission?: ApiKeyPermission };
export type CredentialStorage = 'secure_storage' | 'file';
export type CredentialsFile = {
  active_profile: string;
  storage?: CredentialStorage;
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

export function getCredentialsPath(): string {
  return join(getConfigDir(), 'credentials.json');
}

export const getCredentialsLockPath = (): string =>
  join(getConfigDir(), 'credentials.json.lock');

export function readCredentials(): CredentialsFile | null {
  const configPath = getCredentialsPath();

  if (!existsSync(configPath)) {
    return null;
  }

  const raw = readFileSync(configPath, 'utf-8');

  if (raw.trim().length === 0) {
    return null;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new CorruptedCredentialsError(configPath);
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'api_key' in data &&
    !('profiles' in data) &&
    !('teams' in data)
  ) {
    return {
      active_profile: 'default',
      profiles: {
        default: { api_key: data.api_key as string },
      },
    };
  }

  if ('profiles' in data) {
    const storage =
      data.storage === 'keychain' ? 'secure_storage' : data.storage;
    return {
      active_profile: (data.active_profile as string) ?? 'default',
      ...(storage ? { storage: storage as CredentialStorage } : {}),
      profiles: data.profiles as Record<string, Profile>,
    };
  }

  if ('teams' in data) {
    return {
      active_profile: (data.active_team as string) ?? 'default',
      profiles: data.teams as Record<string, Profile>,
    };
  }

  return null;
}

export function writeCredentials(creds: CredentialsFile): string {
  const configDir = getConfigDir();
  mkdirSync(configDir, { recursive: true, mode: 0o700 });

  const configPath = getCredentialsPath();
  writeFileAtomic(configPath, `${JSON.stringify(creds, null, 2)}\n`, 0o600);
  chmodSync(configPath, 0o600);

  return configPath;
}

export function resolveProfileName(flagValue?: string): string {
  if (flagValue) {
    return flagValue;
  }

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
      return {
        key: entry.api_key,
        source: 'config',
        profile,
        permission: entry.permission,
      };
    }
  }

  return null;
}

export function storeApiKey(
  apiKey: string,
  profileName?: string,
  permission?: ApiKeyPermission,
): string {
  const profile = profileName || 'default';
  const validationError = validateProfileName(profile);
  if (validationError) {
    throw new Error(validationError);
  }

  return withFileLock(getCredentialsLockPath(), () => {
    const creds = readCredentials() || {
      active_profile: 'default',
      profiles: {},
    };

    const updatedProfiles = {
      ...creds.profiles,
      [profile]: {
        api_key: apiKey,
        ...(permission && { permission }),
      },
    };

    const updatedCreds: CredentialsFile = {
      ...creds,
      profiles: updatedProfiles,
      ...(Object.keys(updatedProfiles).length === 1
        ? { active_profile: profile }
        : {}),
    };

    return writeCredentials(updatedCreds);
  });
}

export function removeAllApiKeys(): string {
  const configPath = getCredentialsPath();
  unlinkSync(configPath);
  return configPath;
}

export function removeApiKey(profileName?: string): string {
  return withFileLock(getCredentialsLockPath(), () => {
    const creds = readCredentials();
    if (!creds) {
      throw new Error('No credentials file found.');
    }

    const profile = profileName || resolveProfileName();
    if (!creds.profiles[profile]) {
      throw new Error(
        `Profile "${profile}" not found. Available profiles: ${Object.keys(creds.profiles).join(', ')}`,
      );
    }

    const { [profile]: _, ...remainingProfiles } = creds.profiles;

    if (Object.keys(remainingProfiles).length === 0) {
      const configPath = getCredentialsPath();
      unlinkSync(configPath);
      return configPath;
    }

    const updatedActiveProfile =
      creds.active_profile === profile
        ? Object.keys(remainingProfiles)[0] || 'default'
        : creds.active_profile;

    return writeCredentials({
      ...creds,
      active_profile: updatedActiveProfile,
      profiles: remainingProfiles,
    });
  });
}

export function setActiveProfile(profileName: string): void {
  const validationError = validateProfileName(profileName);
  if (validationError) {
    throw new Error(validationError);
  }

  withFileLock(getCredentialsLockPath(), () => {
    const creds = readCredentials();
    if (!creds) {
      throw new Error('No credentials file found. Run: resend login');
    }
    if (!creds.profiles[profileName]) {
      throw new Error(
        `Profile "${profileName}" not found. Available profiles: ${Object.keys(creds.profiles).join(', ')}`,
      );
    }
    writeCredentials({ ...creds, active_profile: profileName });
  });
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
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    return 'Profile name must contain only letters, numbers, dots, dashes, and underscores';
  }
  return undefined;
}

/** @deprecated Use `validateProfileName` instead */
export const validateTeamName = validateProfileName;

export function renameProfile(oldName: string, newName: string): void {
  if (oldName === newName) {
    return;
  }
  const validationError = validateProfileName(newName);
  if (validationError) {
    throw new Error(validationError);
  }

  withFileLock(getCredentialsLockPath(), () => {
    const creds = readCredentials();
    if (!creds) {
      throw new Error('No credentials file found. Run: resend login');
    }
    if (!creds.profiles[oldName]) {
      throw new Error(
        `Profile "${oldName}" not found. Available profiles: ${Object.keys(creds.profiles).join(', ')}`,
      );
    }
    if (creds.profiles[newName]) {
      throw new Error(`Profile "${newName}" already exists.`);
    }

    const { [oldName]: oldProfile, ...rest } = creds.profiles;

    writeCredentials({
      ...creds,
      active_profile:
        creds.active_profile === oldName ? newName : creds.active_profile,
      profiles: { ...rest, [newName]: oldProfile },
    });
  });
}

export function maskKey(key: string): string {
  if (key.length <= 7) {
    return `${key.slice(0, 3)}...`;
  }
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

export async function resolveApiKeyAsync(
  flagValue?: string,
  profileName?: string,
): Promise<ResolvedKey | null> {
  if (flagValue) {
    return { key: flagValue, source: 'flag' };
  }

  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env' };
  }

  const creds = readCredentials();
  const profile =
    profileName ||
    process.env.RESEND_PROFILE ||
    process.env.RESEND_TEAM ||
    creds?.active_profile ||
    'default';

  if (creds?.storage === 'secure_storage') {
    const backend = await getCredentialBackend();
    const key = await backend.get(SERVICE_NAME, profile);
    if (key) {
      const permission = creds.profiles[profile]?.permission;
      return { key, source: 'secure_storage', profile, permission };
    }
  }

  if (creds) {
    const entry = creds.profiles[profile];
    if (entry?.api_key) {
      const backend = await getCredentialBackend();
      if (backend.isSecure) {
        try {
          await backend.set(SERVICE_NAME, profile, entry.api_key);
          creds.profiles[profile] = {
            ...(entry.permission && { permission: entry.permission }),
          };
          creds.storage = 'secure_storage';
          writeCredentials(creds);
          process.stderr.write(
            `Notice: API key for profile "${profile}" has been moved to ${backend.name}\n`,
          );
        } catch {
          /* non-fatal */
        }
      }
      return {
        key: entry.api_key,
        source: 'config',
        profile,
        permission: entry.permission,
      };
    }
  }

  return null;
}

export async function storeApiKeyAsync(
  apiKey: string,
  profileName?: string,
  permission?: ApiKeyPermission,
): Promise<{ configPath: string; backend: CredentialBackend }> {
  const profile = profileName || 'default';
  const validationError = validateProfileName(profile);
  if (validationError) {
    throw new Error(validationError);
  }

  const backend = await getCredentialBackend();
  const isFileBackend = !backend.isSecure;

  if (isFileBackend) {
    const configPath = storeApiKey(apiKey, profile, permission);
    return { configPath, backend };
  }

  await backend.set(SERVICE_NAME, profile, apiKey);

  const configPath = withFileLock(getCredentialsLockPath(), () => {
    const creds = readCredentials() || {
      active_profile: 'default',
      profiles: {},
    };

    const updatedProfiles = {
      ...creds.profiles,
      [profile]: { ...(permission && { permission }) },
    };

    return writeCredentials({
      ...creds,
      storage: 'secure_storage',
      profiles: updatedProfiles,
      ...(Object.keys(updatedProfiles).length === 1
        ? { active_profile: profile }
        : {}),
    });
  });

  return { configPath, backend };
}

export async function removeApiKeyAsync(profileName?: string): Promise<string> {
  const creds = readCredentials();
  const profile =
    profileName ||
    process.env.RESEND_PROFILE ||
    process.env.RESEND_TEAM ||
    creds?.active_profile ||
    'default';

  if (creds?.storage === 'secure_storage') {
    const backend = await getCredentialBackend();
    if (backend.isSecure) {
      await backend.delete(SERVICE_NAME, profile);
    }
  }

  return removeApiKey(profile);
}

export async function removeAllApiKeysAsync(): Promise<string> {
  const creds = readCredentials();
  const configPath = getCredentialsPath();

  if (creds?.storage === 'secure_storage') {
    const backend = await getCredentialBackend();
    if (backend.isSecure) {
      await Promise.all(
        Object.keys(creds.profiles).map((profile) =>
          backend.delete(SERVICE_NAME, profile),
        ),
      );
    }
  }

  if (existsSync(configPath)) {
    unlinkSync(configPath);
  }
  return configPath;
}

export async function renameProfileAsync(
  oldName: string,
  newName: string,
): Promise<void> {
  const creds = readCredentials();

  if (creds?.storage === 'secure_storage') {
    const backend = await getCredentialBackend();
    if (backend.isSecure) {
      const key = await backend.get(SERVICE_NAME, oldName);
      if (key) {
        await backend.set(SERVICE_NAME, newName, key);
        await backend.delete(SERVICE_NAME, oldName);
      }
    }
  }

  renameProfile(oldName, newName);
}
