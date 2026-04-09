import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const distDir = path.resolve('dist');
const bundlePath = path.join(distDir, 'cli.cjs');
const scriptPath = path.resolve('scripts/verify-bundle.mjs');

const run = () =>
  execSync(`node ${scriptPath}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

const runCatching = () => {
  try {
    const stdout = run();
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { exitCode: e.status, stdout: e.stdout, stderr: e.stderr };
  }
};

describe('verify-bundle', () => {
  let originalBundle: string | undefined;

  beforeEach(() => {
    try {
      originalBundle = require('node:fs').readFileSync(bundlePath, 'utf8');
    } catch {
      originalBundle = undefined;
    }
    mkdirSync(distDir, { recursive: true });
  });

  afterEach(() => {
    if (originalBundle !== undefined) {
      writeFileSync(bundlePath, originalBundle);
    } else {
      rmSync(bundlePath, { force: true });
    }
  });

  it('fails when posthog key is missing', () => {
    writeFileSync(bundlePath, 'require("esbuild"); some content');
    const result = runCatching();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('POSTHOG_PUBLIC_KEY');
  });

  it('fails when esbuild is inlined (bundled marker present)', () => {
    writeFileSync(
      bundlePath,
      'phc_key; The esbuild JavaScript API cannot be bundled; require("esbuild")',
    );
    const result = runCatching();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('esbuild was inlined');
  });

  it('fails when esbuild external require is missing', () => {
    writeFileSync(bundlePath, 'phc_key; no external require here');
    const result = runCatching();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('esbuild external require not found');
  });

  it('passes when bundle is valid', () => {
    writeFileSync(bundlePath, 'phc_key; require("esbuild"); valid bundle');
    const result = runCatching();
    expect(result.exitCode).toBe(0);
  });
});
