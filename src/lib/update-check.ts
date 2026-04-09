import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config';
import { VERSION } from './version';

const CHECK_INTERVAL_MS = 1 * 60 * 60 * 1000;
export const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/resend/resend-cli/releases/latest';

type UpdateState = {
  readonly lastChecked: number;
  readonly latestVersion: string;
};

const getStatePath = (): string => join(getConfigDir(), 'update-state.json');

const readState = (): UpdateState | null => {
  try {
    return JSON.parse(readFileSync(getStatePath(), 'utf-8')) as UpdateState;
  } catch {
    return null;
  }
};

export const resolveNodePath = (): string => {
  if (/(?:^|[\\/])node(?:\.exe)?$/i.test(process.execPath)) {
    return process.execPath;
  }
  return 'node';
};

export const buildRefreshScript = (
  url: string,
  configDir: string,
  statePath: string,
  fallbackVersion: string,
): string => {
  const u = JSON.stringify(url);
  const d = JSON.stringify(configDir);
  const p = JSON.stringify(statePath);
  const fv = JSON.stringify(fallbackVersion);

  return [
    'const{mkdirSync:m,writeFileSync:w}=require("node:fs");',
    `const s=v=>{m(${d},{recursive:true,mode:0o700});`,
    `w(${p},JSON.stringify({lastChecked:Date.now(),latestVersion:v}),{mode:0o600})};`,
    '(async()=>{try{',
    `const r=await fetch(${u},{headers:{Accept:"application/vnd.github.v3+json"},signal:AbortSignal.timeout(5000)});`,
    `if(!r.ok){s(${fv});return}const d=await r.json();`,
    `if(d.prerelease||d.draft){s(${fv});return}`,
    'const v=d.tag_name?.replace(/^v/,"");',
    `if(!v||!/^\\d+\\.\\d+\\.\\d+$/.test(v)){s(${fv});return}`,
    `s(v)}catch{s(${fv})}})();`,
  ].join('');
};

export const spawnBackgroundRefresh = (): void => {
  try {
    const configDir = getConfigDir();
    const statePath = getStatePath();
    const script = buildRefreshScript(
      GITHUB_RELEASES_URL,
      configDir,
      statePath,
      VERSION,
    );
    const child = spawn(resolveNodePath(), ['-e', script], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    /* spawn failure is non-fatal */
  }
};

export const isNewer = (local: string, remote: string): boolean => {
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
};

export const fetchLatestVersion = async (): Promise<string | null> => {
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
};

const shouldSkipCheck = (): boolean => {
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
};

export const detectInstallMethod = (): string => {
  const execPath = process.execPath || process.argv[0] || '';
  const scriptPath = process.argv[1] || '';

  if (
    process.env.npm_execpath ||
    /node_modules/.test(scriptPath) ||
    /node_modules/.test(execPath)
  ) {
    return 'npm install -g resend-cli';
  }

  if (/\/(Cellar|homebrew)\//i.test(execPath)) {
    return 'brew update && brew upgrade resend';
  }

  if (/[/\\]\.resend[/\\]bin[/\\]/.test(execPath)) {
    if (process.platform === 'win32') {
      return 'irm https://resend.com/install.ps1 | iex';
    }
    return 'curl -fsSL https://resend.com/install.sh | bash';
  }

  return 'https://github.com/resend/resend-cli/releases/latest';
};

export const detectInstallMethodName = (): string => {
  const full = detectInstallMethod();
  if (full.startsWith('npm')) {
    return 'npm';
  }
  if (full.startsWith('brew')) {
    return 'homebrew';
  }
  if (full.startsWith('curl') || full.startsWith('irm')) {
    return 'install-script';
  }
  return 'manual';
};

const formatNotice = (latestVersion: string): string => {
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
    return [
      ...lines,
      `${dim}Or download from: ${cyan}https://github.com/resend/resend-cli/releases/latest${reset}`,
      '',
    ].join('\n');
  }

  return [...lines, ''].join('\n');
};

export const checkForUpdates = (): void => {
  if (shouldSkipCheck()) {
    return;
  }

  const state = readState();
  const now = Date.now();

  if (state && now - state.lastChecked < CHECK_INTERVAL_MS) {
    if (isNewer(VERSION, state.latestVersion)) {
      process.stderr.write(formatNotice(state.latestVersion));
    }
    return;
  }

  spawnBackgroundRefresh();

  if (state && isNewer(VERSION, state.latestVersion)) {
    process.stderr.write(formatNotice(state.latestVersion));
  }
};
