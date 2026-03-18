import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config';
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

    const payload = {
      api_key: POSTHOG_API_KEY,
      distinct_id: distinctId,
      event: 'cli.used',
      properties: {
        command,
        cli_version: VERSION,
        os: process.platform,
        arch: process.arch,
        node_version: process.version,
        is_ci:
          process.env.CI === 'true' ||
          process.env.CI === '1' ||
          !!process.env.GITHUB_ACTIONS,
        json_mode: !!opts.json,
        install_method: detectInstallMethodName(),
      },
    };

    fetch(POSTHOG_HOST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch {}
}
