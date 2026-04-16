import { spawn } from 'node:child_process';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { getConfigDir } from './config';
import { isInteractive } from './tty';
import { detectInstallMethodName } from './update-check';
import { VERSION } from './version';

const POSTHOG_API_KEY: string = process.env.POSTHOG_PUBLIC_KEY ?? '';
const POSTHOG_HOST = 'https://us.i.posthog.com/capture/';

const OS_NAMES: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

function friendlyOs(): string {
  return OS_NAMES[process.platform] ?? process.platform;
}

export function getSpoolDir(): string {
  const dir = join(getConfigDir(), 'telemetry-spool');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function isDisabled(): boolean {
  return (
    !POSTHOG_API_KEY ||
    process.env.DO_NOT_TRACK === '1' ||
    process.env.RESEND_TELEMETRY_DISABLED === '1'
  );
}

export function getOrCreateAnonymousId(): string {
  const configDir = getConfigDir();
  const idPath = join(configDir, 'telemetry-id');

  try {
    const existing = readFileSync(idPath, 'utf-8').trim();
    if (existing) {
      return existing;
    }
  } catch {}

  const id = crypto.randomUUID();
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  writeFileSync(idPath, id, { mode: 0o600 });
  return id;
}

function showFirstRunNotice(interactive: boolean): void {
  if (!interactive) {
    return;
  }

  const configDir = getConfigDir();
  const markerPath = join(configDir, 'telemetry-notice-shown');

  if (existsSync(markerPath)) {
    return;
  }

  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  writeFileSync(markerPath, '', { mode: 0o600 });

  process.stderr.write(
    '\nResend collects anonymous CLI usage data to improve the tool.\n' +
      'To opt out: export RESEND_TELEMETRY_DISABLED=1\n\n',
  );
}

export function trackCommand(
  command: string,
  opts: { json?: boolean; flags?: string[]; globalFlags?: string[] },
): void {
  if (isDisabled()) {
    return;
  }

  try {
    const interactive = isInteractive() && !opts.json;
    showFirstRunNotice(interactive);

    const distinctId = getOrCreateAnonymousId();

    const properties: Record<string, unknown> = {
      command,
      cli_version: VERSION,
      os: friendlyOs(),
      node_version: process.version,
      interactive,
      install_method: detectInstallMethodName(),
    };

    if (opts.flags?.length) {
      properties.flags = opts.flags;
    }
    if (opts.globalFlags?.length) {
      properties.global_flags = opts.globalFlags;
    }

    const nonce = crypto.randomUUID();

    const payload = JSON.stringify({
      api_key: POSTHOG_API_KEY,
      distinct_id: distinctId,
      event: 'cli.used',
      properties,
      _nonce: nonce,
    });

    const spoolDir = getSpoolDir();
    const tmpPath = join(
      spoolDir,
      `resend-telemetry-${crypto.randomUUID()}.json`,
    );
    const fd = openSync(
      tmpPath,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    try {
      writeFileSync(fd, payload);
    } finally {
      closeSync(fd);
    }

    const isCompiled = 'pkg' in process;
    const args = isCompiled
      ? ['telemetry', 'flush', tmpPath]
      : process.execArgv.concat([
          process.argv[1],
          'telemetry',
          'flush',
          tmpPath,
        ]);

    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        RESEND_TELEMETRY_DISABLED: '1',
        ...(isCompiled ? { PKG_EXECPATH: '' } : {}),
      },
    });
    child.unref();
  } catch {}
}

type TelemetryPayload = {
  api_key: string;
  distinct_id: string;
  event: 'cli.used';
  properties: Record<string, unknown>;
  _nonce: string;
};

const TELEMETRY_KEYS = new Set([
  'api_key',
  'distinct_id',
  'event',
  'properties',
  '_nonce',
]);

const isTelemetryPayload = (data: unknown): data is TelemetryPayload => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (
    keys.length !== TELEMETRY_KEYS.size ||
    keys.some((k) => !TELEMETRY_KEYS.has(k))
  ) {
    return false;
  }
  return (
    typeof obj.api_key === 'string' &&
    typeof obj.distinct_id === 'string' &&
    obj.event === 'cli.used' &&
    typeof obj.properties === 'object' &&
    obj.properties !== null &&
    !Array.isArray(obj.properties) &&
    typeof obj._nonce === 'string' &&
    obj._nonce.length > 0
  );
};

export async function flushPayload(payload: string): Promise<void> {
  const parsed: unknown = JSON.parse(payload);
  if (!isTelemetryPayload(parsed)) {
    throw new Error('invalid telemetry payload schema');
  }
  const { _nonce: _, ...body } = parsed;
  const sanitized = JSON.stringify(body);
  const res = await fetch(POSTHOG_HOST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: sanitized,
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) {
    throw new Error(`telemetry flush failed: ${res.status}`);
  }
}

const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SPOOL_FILENAME_RE = new RegExp(`^resend-telemetry-${UUID_RE}\\.json$`);

export async function flushFromFile(filePath: string): Promise<void> {
  const resolved = join(filePath);
  const spoolDir = getSpoolDir();
  const baseName = basename(resolved);

  if (
    dirname(resolved) !== spoolDir ||
    !SPOOL_FILENAME_RE.test(baseName) ||
    realpathSync(dirname(resolved)) !== realpathSync(spoolDir)
  ) {
    throw new Error('invalid telemetry flush path');
  }

  const fd = openSync(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
  let payload: string;
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1) {
      throw new Error('invalid telemetry flush path');
    }
    payload = readFileSync(fd, 'utf-8');
  } finally {
    closeSync(fd);
  }

  try {
    await flushPayload(payload);
  } finally {
    unlinkSync(resolved);
  }
}
