import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config';
import { isInteractive } from './tty';
import { detectInstallMethodName } from './update-check';
import { VERSION } from './version';

const POSTHOG_API_KEY = 'phc_REPLACE_ME';
const POSTHOG_HOST = 'https://us.i.posthog.com/capture/';

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
        os: process.platform,
        arch: process.arch,
        node_version: process.version,
        interactive: isInteractive() && !opts.json,
        install_method: detectInstallMethodName(),
      },
    });

    const child = spawn(
      process.execPath,
      process.execArgv.concat([process.argv[1], 'telemetry', 'flush', payload]),
      {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, RESEND_TELEMETRY_DISABLED: '1' },
      },
    );
    child.unref();
  } catch {}
}

export async function flushPayload(payload: string): Promise<void> {
  await fetch(POSTHOG_HOST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    signal: AbortSignal.timeout(3000),
  });
}
