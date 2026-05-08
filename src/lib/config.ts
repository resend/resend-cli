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
import {
  type CredentialBackend,
  getCredentialBackend,
  SERVICE_NAME,
} from './credential-store';

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

export function readCredentials(): CredentialsFile | null {
  try {
    const data = JSON.parse(readFileSync(getCredentialsPath(), 'utf-8'));
    if (data.profiles) {
      return {
        active_profile: data.active_profile ?? 'default',
        ...(data.storage ? { storage: data.storage } : {}),
        profiles: data.profiles,
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

  const envProfile = process.env.RESEND_PROFILE;
  if (envProfile) {
    return envProfile;
  }

  const creds = readCredentials();
  if (creds?.active_profile) {
    return creds.active_profile;
  }

  return 'default';
}

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
  const creds = readCredentials() || {
    active_profile: 'default',
    profiles: {},
  };

  creds.profiles[profile] = {
    api_key: apiKey,
    ...(permission && { permission }),
  };

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
    // File exists but is not valid credentials — delete it
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

export function renameProfile(oldName: string, newName: string): void {
  if (oldName === newName) {
    return;
  }
  const validationError = validateProfileName(newName);
  if (validationError) {
    throw new Error(validationError);
  }
  const creds = readCredentials();
  if (!creds) {
    throw new Error('No credentials file found. Run: resend login');
  }
  if (!creds.profiles[oldName]) {
    throw new Error(
      `Profile "${oldName}" not found. Available profiles: ${Object.keys(creds.profiles).join(', ')}`,
    );
  }
  if (oldName !== newName && creds.profiles[newName]) {
    throw new Error(`Profile "${newName}" already exists.`);
  }
  creds.profiles[newName] = creds.profiles[oldName];
  delete creds.profiles[oldName];
  if (creds.active_profile === oldName) {
    creds.active_profile = newName;
  }
  writeCredentials(creds);
}

export function maskKey(key: string): string {
  if (key.length <= 7) {
    return `${key.slice(0, 3)}...`;
  }
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}

// --- Async variants that route through the credential backend ---

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
    creds?.active_profile ||
    'default';

  if (creds?.storage === 'secure_storage' && creds.profiles[profile]) {
    const backend = await getCredentialBackend();
    const key = await backend.get(SERVICE_NAME, profile);
    if (key) {
      const permission = creds.profiles[profile]?.permission;
      return { key, source: 'secure_storage', profile, permission };
    }
  }

  // File-based storage
  if (creds) {
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
    // Do NOT clear a pre-existing `storage: 'secure_storage'` marker here.
    // Other profiles may still have their keys in secure storage.
    // resolveApiKeyAsync already falls through from secure storage to file-based
    // lookup, so keeping the marker is safe and avoids orphaning those profiles.
    const configPath = storeApiKey(apiKey, profile, permission);
    return { configPath, backend };
  }

  // Store in secure backend
  await backend.set(SERVICE_NAME, profile, apiKey);

  // Update credentials file: mark storage as secure, keep profile entry (without api_key)
  const creds = readCredentials() || {
    active_profile: 'default',
    profiles: {},
  };
  creds.storage = 'secure_storage';
  creds.profiles[profile] = { ...(permission && { permission }) };

  if (Object.keys(creds.profiles).length === 1) {
    creds.active_profile = profile;
  }

  const configPath = writeCredentials(creds);
  return { configPath, backend };
}

export async function removeApiKeyAsync(profileName?: string): Promise<string> {
  const creds = readCredentials();
  const profile =
    profileName ||
    process.env.RESEND_PROFILE ||
    creds?.active_profile ||
    'default';

  if (!creds?.profiles[profile]) {
    throw new Error(
      creds
        ? `Profile "${profile}" not found. Available profiles: ${Object.keys(creds.profiles).join(', ')}`
        : 'No credentials file found.',
    );
  }

  if (creds.storage === 'secure_storage') {
    const backend = await getCredentialBackend();
    if (backend.isSecure) {
      const deleted = await backend.delete(SERVICE_NAME, profile);
      if (!deleted) {
        throw new Error(
          `Failed to remove API key for profile "${profile}" from ${backend.name}. Credential may still exist in secure storage.`,
        );
      }
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
      const profileNames = Object.keys(creds.profiles);
      const results = await Promise.all(
        profileNames.map((profile) => backend.delete(SERVICE_NAME, profile)),
      );
      const failed = profileNames.filter((_, i) => !results[i]);
      if (failed.length > 0) {
        // Remove successfully-deleted profiles from the file so retries
        // only re-attempt the ones that actually failed.
        const succeeded = profileNames.filter((_, i) => results[i]);
        for (const name of succeeded) {
          delete creds.profiles[name];
        }
        if (creds.active_profile && !creds.profiles[creds.active_profile]) {
          const remaining = Object.keys(creds.profiles);
          creds.active_profile = remaining[0] || 'default';
        }
        writeCredentials(creds);
        throw new Error(
          `Failed to remove API keys from ${backend.name} for profiles: ${failed.join(', ')}. Credentials may still exist in secure storage.`,
        );
      }
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
        const deleted = await backend.delete(SERVICE_NAME, oldName);
        if (!deleted) {
          const rolledBack = await backend.delete(SERVICE_NAME, newName);
          throw new Error(
            rolledBack
              ? `Failed to remove old credential "${oldName}" from ${backend.name} during rename. The rename has been rolled back.`
              : `Failed to remove old credential "${oldName}" from ${backend.name} during rename. Rollback also failed — credential "${newName}" may still exist in secure storage.`,
          );
        }
      }
    }
  }

  renameProfile(oldName, newName);
}
