/**
 * E2E smoke tests — runs real CLI commands against the Resend API.
 *
 * These are NOT part of the normal test suite. Run them manually:
 *
 *   npm run test:e2e
 *
 * Requirements:
 *   - A valid API key via RESEND_API_KEY env var or `resend login`
 *
 * These tests are read-only — they list resources and validate the CLI
 * can talk to the API and format responses. Nothing is created or deleted.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLI = resolve(import.meta.dirname, '../../src/cli.ts');

function run(...args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync('npx', ['tsx', CLI, ...args, '--json', '-q'], {
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; status?: number };
    return {
      stdout: (e.stdout ?? '').trim(),
      exitCode: e.status ?? 1,
    };
  }
}

function parseJson(stdout: string): unknown {
  const parsed = JSON.parse(stdout);
  expect(parsed).toBeDefined();
  return parsed;
}

describe('e2e smoke', () => {
  it('doctor reports check results', () => {
    const { stdout } = run('doctor');
    const data = parseJson(stdout) as { checks: unknown[] };
    expect(data.checks).toBeInstanceOf(Array);
    expect(data.checks.length).toBeGreaterThan(0);
    // If API key is valid, ok should be true; either way the shape is correct
    expect(data).toHaveProperty('ok');
  });

  it('domains list returns valid json', () => {
    const { stdout, exitCode } = run('domains', 'list');
    expect(exitCode).toBe(0);
    const data = parseJson(stdout) as { object: string; data: unknown[] };
    expect(data.object).toBe('list');
    expect(data.data).toBeInstanceOf(Array);
  });

  it('api-keys list returns valid json', () => {
    const { stdout, exitCode } = run('api-keys', 'list');
    expect(exitCode).toBe(0);
    const data = parseJson(stdout) as { object: string; data: unknown[] };
    expect(data.object).toBe('list');
    expect(data.data).toBeInstanceOf(Array);
  });

  it('broadcasts list returns valid json', () => {
    const { stdout, exitCode } = run('broadcasts', 'list');
    expect(exitCode).toBe(0);
    const data = parseJson(stdout) as { object: string; data: unknown[] };
    expect(data.object).toBe('list');
    expect(data.data).toBeInstanceOf(Array);
  });

  it('webhooks list returns valid json', () => {
    const { stdout, exitCode } = run('webhooks', 'list');
    expect(exitCode).toBe(0);
    const data = parseJson(stdout) as { object: string; data: unknown[] };
    expect(data.object).toBe('list');
    expect(data.data).toBeInstanceOf(Array);
  });

  it('topics list returns valid json', () => {
    const { stdout, exitCode } = run('topics', 'list');
    expect(exitCode).toBe(0);
    const data = parseJson(stdout) as { object: string; data: unknown[] };
    expect(data.object).toBe('list');
    expect(data.data).toBeInstanceOf(Array);
  });
});
