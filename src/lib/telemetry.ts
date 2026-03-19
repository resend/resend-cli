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

const POSTHOG_API_KEY = 'phc_REPLACE_ME';
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

function showFirstRunNotice(): void {
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

export function trackCommand(command: string, opts: { json?: boolean }): void {
  if (isDisabled()) {
    return;
  }

  try {
    showFirstRunNotice();

    const distinctId = getOrCreateAnonymousId();

    const payload = JSON.stringify({
      api_key: POSTHOG_API_KEY,
      distinct_id: distinctId,
      event: 'cli.used',
      properties: {
        command,
        cli_version: VERSION,
        os: friendlyOs(),
        node_version: process.version,
        interactive: isInteractive() && !opts.json,
        install_method: detectInstallMethodName(),
      },
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
      env: { ...process.env, RESEND_TELEMETRY_DISABLED: '1' },
    });
    child.unref();
  } catch {}
}

export async function flushPayload(payload: string): Promise<void> {
  JSON.parse(payload);
  await fetch(POSTHOG_HOST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    signal: AbortSignal.timeout(3000),
  });
}

export async function flushFromFile(filePath: string): Promise<void> {
  const payload = readFileSync(filePath, 'utf-8');
  unlinkSync(filePath);
  await flushPayload(payload);
}
