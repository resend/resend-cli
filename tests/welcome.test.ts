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
  test('exits 0 and shows help when invoked with no arguments', () => {
    const execOptions: ExecFileSyncOptions = {
      encoding: 'utf-8',
      timeout: 10_000,
      env: noUpdateEnv,
      ...(process.platform === 'win32' ? { shell: true } : {}),
    };
    const stdout = execFileSync('npx', ['tsx', CLI], execOptions) as string;
    expect(stdout).toContain('Usage: resend');
  });

  test('skips banner when stdout is not a TTY', () => {
    const execOptions: ExecFileSyncOptions = {
      encoding: 'utf-8',
      timeout: 10_000,
      env: noUpdateEnv,
      ...(process.platform === 'win32' ? { shell: true } : {}),
    };
    const stdout = execFileSync('npx', ['tsx', CLI], execOptions) as string;
    expect(stdout).not.toContain('██████╗');
  });
});
