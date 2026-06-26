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
import { refreshOAuthGrant } from './oauth';
import { writeFileAtomic } from './write-file-atomic';

export type ApiKeyPermission = 'full_access' | 'sending_access';

export const SENDING_KEY_MESSAGE =
  'Sending-only keys work with: emails send, emails batch, broadcasts send.\nCreate a full access key at https://resend.com/api-keys';
export type ApiKeySource = 'flag' | 'env' | 'config' | 'secure_storage';

export type ResolvedApiKey = {
  type: 'api_key';
  key: string;
  source: ApiKeySource;
  profile?: string;
  permission?: ApiKeyPermission;
};

export type ResolvedOAuthGrant = {
  type: 'oauth_grant';
  access_token: string;
  profile: string;
  scope: string;
  source: Extract<ApiKeySource, 'config' | 'secure_storage'>;
};

export type ResolvedAuthentication = ResolvedApiKey | ResolvedOAuthGrant;

export type ApiKeyCredential = {
  type: 'api_key';
  api_key?: string; // absent when stored in OS keychain via secure_storage
  permission?: ApiKeyPermission;
};

// The full grant. Persisted as one unit: a keychain blob when secure storage is
// available, else inline in credentials.json. No refresh-token expiry exists — the
// server doesn't return one, so a failed refresh is the only end-of-session signal.
export type OAuthGrantData = {
  access_token: string;
  access_token_expires_at: number; // unix seconds, decoded from JWT exp claim
  refresh_token: string;
  scope: string; // e.g. 'full_access' or 'emails:send'
};

// File representation: token fields are absent when the grant lives in the keychain
// (secure storage), present only in the plaintext fallback.
export type OAuthGrant = {
  type: 'oauth_grant';
  scope: string;
} & Partial<OAuthGrantData>;

export type Credential = ApiKeyCredential | OAuthGrant;
export type Profile = Credential;
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

export const getCredentialsLockPath = (): string =>
  join(getConfigDir(), 'credentials.json.lock');

function migrateRawProfile(raw: Record<string, unknown>): Profile {
  if (raw.type === 'oauth_grant') {
    // Validate rather than blindly cast: keep a complete grant or a metadata-only
    // secure entry; drop an incomplete one to metadata so it prompts re-login
    // instead of bricking the whole file.
    if (isCompleteOAuthGrant(raw)) {
      return { type: 'oauth_grant', ...raw };
    }
    return {
      type: 'oauth_grant',
      scope: typeof raw.scope === 'string' ? raw.scope : '',
    };
  }
  return {
    type: 'api_key',
    ...(raw.api_key !== undefined ? { api_key: raw.api_key as string } : {}),
    ...(raw.permission
      ? { permission: raw.permission as ApiKeyPermission }
      : {}),
  };
}

// Best-effort read: returns null on any failure (corruption, EISDIR, EACCES,
// etc). Callers that intend to delete the file regardless of contents (e.g.
// "logout all") use this so the CLI stays usable even when the file is
// unreadable.
export function tryReadCredentials(): CredentialsFile | null {
  try {
    return readCredentials();
  } catch {
    return null;
  }
}

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
        default: { type: 'api_key', api_key: data.api_key as string },
      },
    };
  }

  if ('profiles' in data) {
    const storage =
      data.storage === 'keychain' ? 'secure_storage' : data.storage;
    const rawProfiles = data.profiles as Record<
      string,
      Record<string, unknown>
    >;
    return {
      active_profile: (data.active_profile as string) ?? 'default',
      ...(storage ? { storage: storage as CredentialStorage } : {}),
      profiles: Object.fromEntries(
        Object.entries(rawProfiles).map(([name, raw]) => [
          name,
          migrateRawProfile(raw),
        ]),
      ),
    };
  }

  if ('teams' in data) {
    const rawTeams = data.teams as Record<string, Record<string, unknown>>;
    return {
      active_profile: (data.active_team as string) ?? 'default',
      profiles: Object.fromEntries(
        Object.entries(rawTeams).map(([name, raw]) => [
          name,
          migrateRawProfile(raw),
        ]),
      ),
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
): ResolvedApiKey | null {
  if (flagValue) {
    return { type: 'api_key', key: flagValue, source: 'flag' };
  }

  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    return { type: 'api_key', key: envKey, source: 'env' };
  }

  const creds = readCredentials();
  if (creds) {
    const profile = resolveProfileName(profileName);
    const entry = creds.profiles[profile];
    if (entry?.type === 'api_key' && entry.api_key) {
      return {
        type: 'api_key',
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
        type: 'api_key' as const,
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
  return withFileLock(getCredentialsLockPath(), () => {
    const configPath = getCredentialsPath();
    unlinkSync(configPath);
    return configPath;
  });
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

export function isCompleteOAuthGrant(value: unknown): value is OAuthGrantData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const g = value as Record<string, unknown>;
  return (
    typeof g.access_token === 'string' &&
    typeof g.access_token_expires_at === 'number' &&
    typeof g.refresh_token === 'string' &&
    typeof g.scope === 'string'
  );
}

// Returns null when token fields are absent (e.g. a secure-storage entry whose
// keychain secret is gone) so the caller treats it as not-authenticated.
function oauthGrantFromEntry(entry: OAuthGrant): OAuthGrantData | null {
  return isCompleteOAuthGrant(entry) ? entry : null;
}

function parseOAuthGrantBlob(secret: string): OAuthGrantData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(secret);
  } catch {
    parsed = null;
  }
  if (!isCompleteOAuthGrant(parsed)) {
    throw new Error(
      'Stored OAuth credentials are invalid. Please run `resend login` to authenticate again.',
    );
  }
  return parsed;
}

export async function resolveAuthentication(
  flagValue?: string,
  profileName?: string,
  options?: { refresh?: boolean },
): Promise<ResolvedAuthentication | null> {
  if (flagValue) {
    return { type: 'api_key', key: flagValue, source: 'flag' };
  }

  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    return { type: 'api_key', key: envKey, source: 'env' };
  }

  const creds = readCredentials();
  const profile =
    profileName ||
    process.env.RESEND_PROFILE ||
    creds?.active_profile ||
    'default';

  if (creds?.storage === 'secure_storage' && creds.profiles[profile]) {
    const credential = creds.profiles[profile];
    const backend = await getCredentialBackend();
    const secret = await backend.get(SERVICE_NAME, profile);
    if (secret) {
      if (credential.type === 'oauth_grant') {
        const grant = parseOAuthGrantBlob(secret);
        return resolveGrant(grant, profile, 'secure_storage', options);
      }
      return {
        type: 'api_key',
        key: secret,
        source: 'secure_storage',
        profile,
        permission: credential.permission,
      };
    }
  }

  if (creds) {
    const entry = creds.profiles[profile];
    if (entry?.type === 'api_key' && entry.api_key) {
      return {
        type: 'api_key',
        key: entry.api_key,
        source: 'config',
        profile,
        permission: entry.permission,
      };
    }
    if (entry?.type === 'oauth_grant') {
      const grant = oauthGrantFromEntry(entry);
      if (grant) {
        return resolveGrant(grant, profile, 'config', options);
      }
    }
  }

  return null;
}

async function resolveGrant(
  grant: OAuthGrantData,
  profile: string,
  source: ResolvedOAuthGrant['source'],
  options?: { refresh?: boolean },
): Promise<ResolvedOAuthGrant> {
  if (options?.refresh === false) {
    return {
      type: 'oauth_grant',
      access_token: grant.access_token,
      profile,
      scope: grant.scope,
      source,
    };
  }
  const { access_token, scope } = await refreshOAuthGrant(grant, profile);
  return { type: 'oauth_grant', access_token, profile, scope, source };
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

  if (!backend.isSecure) {
    const configPath = storeApiKey(apiKey, profile, permission);
    return { configPath, backend };
  }

  const configPath = await withFileLock(getCredentialsLockPath(), async () => {
    await backend.set(SERVICE_NAME, profile, apiKey);

    const creds = readCredentials() || {
      active_profile: 'default',
      profiles: {},
    };

    const updatedProfiles = {
      ...creds.profiles,
      [profile]: {
        type: 'api_key' as const,
        ...(permission && { permission }),
      },
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

export async function storeOAuthGrant(
  grant: OAuthGrantData,
  profileName?: string,
): Promise<{ configPath: string; backend: CredentialBackend }> {
  const profile = profileName || 'default';
  const validationError = validateProfileName(profile);
  if (validationError) {
    throw new Error(validationError);
  }

  const backend = await getCredentialBackend();

  const configPath = await withFileLock(getCredentialsLockPath(), async () => {
    const creds = readCredentials() || {
      active_profile: 'default',
      profiles: {},
    };

    // Secure backend: secrets go to the keychain blob, only metadata to the file;
    // backend.set overwrites any prior secret in the slot, so no explicit delete.
    // No secure backend: store the full grant inline, like API keys degrade.
    const profileEntry: OAuthGrant = backend.isSecure
      ? { type: 'oauth_grant', scope: grant.scope }
      : { type: 'oauth_grant', ...grant };

    if (backend.isSecure) {
      await backend.set(SERVICE_NAME, profile, JSON.stringify(grant));
    }

    const updatedProfiles = {
      ...creds.profiles,
      [profile]: profileEntry,
    };

    try {
      return writeCredentials({
        ...creds,
        storage: backend.isSecure ? 'secure_storage' : 'file',
        profiles: updatedProfiles,
        ...(Object.keys(updatedProfiles).length === 1
          ? { active_profile: profile }
          : {}),
      });
    } catch (err) {
      // The secret is already in the keychain; if writing the metadata fails, drop
      // it so the file and keychain can't disagree on the profile type — otherwise
      // resolveAuthentication would read the OAuth blob as an API key.
      if (backend.isSecure) {
        await backend.delete(SERVICE_NAME, profile).catch(() => {});
      }
      throw err;
    }
  });

  return { configPath, backend };
}

export async function removeApiKeyAsync(profileName?: string): Promise<string> {
  return withFileLock(getCredentialsLockPath(), async () => {
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

export async function removeAllApiKeysAsync(): Promise<string> {
  return withFileLock(getCredentialsLockPath(), async () => {
    // Tolerate corruption: the user is asking to nuke everything, so a
    // corrupted file should still be removable via the CLI. Orphaned
    // secure-storage entries are harmless and can be cleaned up from the
    // system keychain UI if the user cares.
    const creds = tryReadCredentials();
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
          // Persist partial-deletion progress so retries only re-attempt
          // the profiles that actually failed.
          const remainingProfiles = Object.fromEntries(
            Object.entries(creds.profiles).filter(
              ([name]) => !results[profileNames.indexOf(name)],
            ),
          );
          const remainingNames = Object.keys(remainingProfiles);
          writeCredentials({
            ...creds,
            active_profile:
              creds.active_profile && remainingProfiles[creds.active_profile]
                ? creds.active_profile
                : (remainingNames[0] ?? 'default'),
            profiles: remainingProfiles,
          });
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
  });
}

export async function renameProfileAsync(
  oldName: string,
  newName: string,
): Promise<void> {
  if (oldName === newName) {
    return;
  }
  const validationError = validateProfileName(newName);
  if (validationError) {
    throw new Error(validationError);
  }

  await withFileLock(getCredentialsLockPath(), async () => {
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

    if (creds.storage === 'secure_storage') {
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

    const { [oldName]: oldProfile, ...rest } = creds.profiles;
    writeCredentials({
      ...creds,
      active_profile:
        creds.active_profile === oldName ? newName : creds.active_profile,
      profiles: { ...rest, [newName]: oldProfile },
    });
  });
}
