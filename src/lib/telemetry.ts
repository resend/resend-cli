import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

    const payload = JSON.stringify({
      api_key: POSTHOG_API_KEY,
      distinct_id: distinctId,
      event: 'cli.used',
      properties,
    });

    const tmpPath = join(
      tmpdir(),
      `resend-telemetry-${process.pid}-${Date.now()}.json`,
    );
    writeFileSync(tmpPath, payload, { mode: 0o600 });

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

export async function flushPayload(payload: string): Promise<void> {
  JSON.parse(payload);
  const res = await fetch(POSTHOG_HOST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) {
    throw new Error(`telemetry flush failed: ${res.status}`);
  }
}

export async function flushFromFile(filePath: string): Promise<void> {
  const resolved = join(filePath);
  if (
    !resolved.startsWith(tmpdir()) ||
    !/resend-telemetry-.*\.json$/.test(resolved)
  ) {
    throw new Error('invalid telemetry flush path');
  }
  const payload = readFileSync(resolved, 'utf-8');
  await flushPayload(payload);
  unlinkSync(resolved);
}
