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
export type ResolvedKey = { key: string; source: ApiKeySource; team?: string };

export type TeamProfile = { api_key: string };
export type CredentialsFile = {
  active_team: string;
  teams: Record<string, TeamProfile>;
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

function getCredentialsPath(): string {
  return join(getConfigDir(), 'credentials.json');
}

export function readCredentials(): CredentialsFile | null {
  try {
    const data = JSON.parse(readFileSync(getCredentialsPath(), 'utf-8'));
    // Support legacy format: { api_key: "re_xxx" }
    if (data.api_key && !data.teams) {
      return {
        active_team: 'default',
        teams: { default: { api_key: data.api_key } },
      };
    }
    if (data.teams) {
      return data as CredentialsFile;
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

export function resolveTeamName(flagValue?: string): string {
  if (flagValue) {
    return flagValue;
  }

  const envTeam = process.env.RESEND_TEAM;
  if (envTeam) {
    return envTeam;
  }

  const creds = readCredentials();
  if (creds?.active_team) {
    return creds.active_team;
  }

  return 'default';
}

export function resolveApiKey(
  flagValue?: string,
  teamName?: string,
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
    const team = resolveTeamName(teamName);
    const profile = creds.teams[team];
    if (profile?.api_key) {
      return { key: profile.api_key, source: 'config', team };
    }
  }

  return null;
}

export function storeApiKey(apiKey: string, teamName?: string): string {
  const team = teamName || 'default';
  const validationError = validateTeamName(team);
  if (validationError) {
    throw new Error(validationError);
  }
  const creds = readCredentials() || { active_team: 'default', teams: {} };

  creds.teams[team] = { api_key: apiKey };

  // If this is the first team, set it as active
  if (Object.keys(creds.teams).length === 1) {
    creds.active_team = team;
  }

  return writeCredentials(creds);
}

export function removeAllApiKeys(): string {
  const configPath = getCredentialsPath();
  unlinkSync(configPath);
  return configPath;
}

export function removeApiKey(teamName?: string): string {
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

  const team = teamName || resolveTeamName();
  if (!creds.teams[team]) {
    throw new Error(
      `Team "${team}" not found. Available teams: ${Object.keys(creds.teams).join(', ')}`,
    );
  }
  delete creds.teams[team];

  // If we removed the active team, switch to first available or "default"
  if (creds.active_team === team) {
    const remaining = Object.keys(creds.teams);
    creds.active_team = remaining[0] || 'default';
  }

  // If no teams left, delete the file
  if (Object.keys(creds.teams).length === 0) {
    const configPath = getCredentialsPath();
    unlinkSync(configPath);
    return configPath;
  }

  return writeCredentials(creds);
}

export function setActiveTeam(teamName: string): void {
  const validationError = validateTeamName(teamName);
  if (validationError) {
    throw new Error(validationError);
  }
  const creds = readCredentials();
  if (!creds) {
    throw new Error('No credentials file found. Run: resend login');
  }
  if (!creds.teams[teamName]) {
    throw new Error(
      `Team "${teamName}" not found. Available teams: ${Object.keys(creds.teams).join(', ')}`,
    );
  }
  creds.active_team = teamName;
  writeCredentials(creds);
}

export function listTeams(): Array<{ name: string; active: boolean }> {
  const creds = readCredentials();
  if (!creds) {
    return [];
  }
  return Object.keys(creds.teams).map((name) => ({
    name,
    active: name === creds.active_team,
  }));
}

export function validateTeamName(name: string): string | undefined {
  if (!name || name.length === 0) {
    return 'Team name must not be empty';
  }
  if (name.length > 64) {
    return 'Team name must be 64 characters or fewer';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return 'Team name must contain only letters, numbers, dashes, and underscores';
  }
  return undefined;
}

export function maskKey(key: string): string {
  if (key.length <= 7) {
    return `${key.slice(0, 3)}...`;
  }
  return `${key.slice(0, 3)}...${key.slice(-4)}`;
}
