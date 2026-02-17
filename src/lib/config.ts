import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export type ApiKeySource = 'flag' | 'env' | 'config';
export type ResolvedKey = { key: string; source: ApiKeySource };

export function getConfigDir(): string {
  if (process.env.XDG_CONFIG_HOME) {
    return join(process.env.XDG_CONFIG_HOME, 'resend');
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    return join(process.env.APPDATA, 'resend');
  }
  return join(homedir(), '.config', 'resend');
}

export function resolveApiKey(flagValue?: string): ResolvedKey | null {
  if (flagValue) {
    return { key: flagValue, source: 'flag' };
  }

  const envKey = process.env.RESEND_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env' };
  }

  try {
    const configPath = join(getConfigDir(), 'credentials.json');
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (data.api_key) {
      return { key: data.api_key, source: 'config' };
    }
  } catch {
    // No config file or invalid JSON — not an error
  }

  return null;
}

export function storeApiKey(apiKey: string): string {
  const configDir = getConfigDir();
  mkdirSync(configDir, { recursive: true, mode: 0o700 });

  const configPath = join(configDir, 'credentials.json');
  writeFileSync(configPath, JSON.stringify({ api_key: apiKey }, null, 2) + '\n', {
    mode: 0o600,
  });

  return configPath;
}
