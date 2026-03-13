import { type ExecFileSyncOptions, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const CLI = resolve(import.meta.dirname, '../src/cli.ts');

const noUpdateEnv = {
  ...process.env,
  RESEND_NO_UPDATE_NOTIFIER: '1',
  NO_COLOR: '1',
};

describe('no-args welcome', () => {
  test('exits 0 and stdout contains tagline and command hints', () => {
    let stdout: string;
    let exitCode: number;
    const execOptions: ExecFileSyncOptions = {
      encoding: 'utf-8',
      timeout: 10_000,
      env: noUpdateEnv,
      ...(process.platform === 'win32' ? { shell: true } : {}),
    };
    try {
      const result = execFileSync('npx', ['tsx', CLI], execOptions);
      stdout = Buffer.isBuffer(result) ? result.toString('utf8') : result;
      exitCode = 0;
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      stdout = (e.stdout ?? '').trim();
      exitCode = e.status ?? 1;
    }
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Power your emails with code');
    expect(stdout).toContain('resend --help');
    expect(stdout).toContain('resend login');
  });
});
