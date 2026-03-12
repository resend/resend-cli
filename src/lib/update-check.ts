import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config';
import { VERSION } from './version';

const CHECK_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hour
export const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/resend/resend-cli/releases/latest';

type UpdateState = {
  lastChecked: number;
  latestVersion: string;
};

function getStatePath(): string {
  return join(getConfigDir(), 'update-state.json');
}

function readState(): UpdateState | null {
  try {
    return JSON.parse(readFileSync(getStatePath(), 'utf-8')) as UpdateState;
  } catch {
    return null;
  }
}

function writeState(state: UpdateState): void {
  mkdirSync(getConfigDir(), { recursive: true, mode: 0o700 });
  writeFileSync(getStatePath(), JSON.stringify(state), { mode: 0o600 });
}

/**
 * Compare two semver strings. Returns true if remote > local.
 */
function isNewer(local: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [lMaj, lMin, lPat] = parse(local);
  const [rMaj, rMin, rPat] = parse(remote);
  if (rMaj !== lMaj) {
    return rMaj > lMaj;
  }
  if (rMin !== lMin) {
    return rMin > lMin;
  }
  return rPat > lPat;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(GITHUB_RELEASES_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      tag_name?: string;
      prerelease?: boolean;
      draft?: boolean;
    };
    // /releases/latest already excludes prereleases, but guard anyway
    if (data.prerelease || data.draft) {
      return null;
    }
    const version = data.tag_name?.replace(/^v/, '');
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
      return null;
    }
    return version;
  } catch {
    return null;
  }
}

function shouldSkipCheck(): boolean {
  if (process.env.RESEND_NO_UPDATE_NOTIFIER === '1') {
    return true;
  }
  if (process.env.CI === 'true' || process.env.CI === '1') {
    return true;
  }
  if (process.env.GITHUB_ACTIONS) {
    return true;
  }
  if (!process.stdout.isTTY) {
    return true;
  }
  return false;
}

function detectInstallMethod(): string {
  const execPath = process.execPath || process.argv[0] || '';

  // Homebrew
  if (/\/(Cellar|homebrew)\//i.test(execPath)) {
    return 'brew update && brew upgrade resend';
  }

  // npm / npx global install
  if (/node_modules/.test(execPath) || process.env.npm_execpath) {
    return 'npm install -g resend-cli';
  }

  // Install script (default install location)
  if (/[/\\]\.resend[/\\]bin[/\\]/.test(execPath)) {
    if (process.platform === 'win32') {
      return 'irm https://resend.com/install.ps1 | iex';
    }
    return 'curl -fsSL https://resend.com/install.sh | bash';
  }

  // Default
  if (process.platform === 'win32') {
    return 'irm https://resend.com/install.ps1 | iex';
  }
  return 'curl -fsSL https://resend.com/install.sh | bash';
}

function formatNotice(latestVersion: string): string {
  const upgrade = detectInstallMethod();
  const isUrl = upgrade.startsWith('http');

  const dim = '\x1B[2m';
  const yellow = '\x1B[33m';
  const cyan = '\x1B[36m';
  const reset = '\x1B[0m';

  const lines = [
    '',
    `${dim}Update available: ${yellow}v${VERSION}${reset}${dim} → ${cyan}v${latestVersion}${reset}`,
    `${dim}${isUrl ? 'Visit' : 'Run'}: ${cyan}${upgrade}${reset}`,
  ];

  if (process.platform === 'win32') {
    lines.push(
      `${dim}Or download from: ${cyan}https://github.com/resend/resend-cli/releases/latest${reset}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Check for updates and print a notice to stderr if one is available.
 * Designed to be called after the main command completes — never blocks
 * or throws.
 */
export async function checkForUpdates(): Promise<void> {
  if (shouldSkipCheck()) {
    return;
  }

  const state = readState();
  const now = Date.now();

  // If we have a cached check that's still fresh, just use it
  if (state && now - state.lastChecked < CHECK_INTERVAL_MS) {
    if (isNewer(VERSION, state.latestVersion)) {
      process.stderr.write(formatNotice(state.latestVersion));
    }
    return;
  }

  // Stale or missing — fetch in the background
  const latest = await fetchLatestVersion();
  if (!latest) {
    return;
  }

  writeState({ lastChecked: now, latestVersion: latest });

  if (isNewer(VERSION, latest)) {
    process.stderr.write(formatNotice(latest));
  }
}
