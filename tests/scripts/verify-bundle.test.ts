import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const scriptPath = path.resolve('scripts/verify-bundle.mjs');

const run = (bundlePath: string) =>
  execSync(`node ${scriptPath} ${bundlePath}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

const runCatching = (bundlePath: string) => {
  try {
    const stdout = run(bundlePath);
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { exitCode: e.status, stdout: e.stdout, stderr: e.stderr };
  }
};

const validBundle =
  'phc_key; require("esbuild"); require("esbuild-wasm"); valid bundle';

describe('verify-bundle', () => {
  let tmpDir: string;
  let bundlePath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'verify-bundle-test-'));
    bundlePath = path.join(tmpDir, 'cli.cjs');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails when posthog key is missing', () => {
    writeFileSync(
      bundlePath,
      'require("esbuild"); require("esbuild-wasm"); some content',
    );
    const result = runCatching(bundlePath);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('POSTHOG_PUBLIC_KEY');
  });

  it('fails when esbuild is inlined (bundled marker present)', () => {
    writeFileSync(
      bundlePath,
      'phc_key; The esbuild JavaScript API cannot be bundled; require("esbuild"); require("esbuild-wasm")',
    );
    const result = runCatching(bundlePath);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('esbuild was inlined');
  });

  it('fails when esbuild external require is missing', () => {
    writeFileSync(
      bundlePath,
      'phc_key; require("esbuild-wasm"); no esbuild require here',
    );
    const result = runCatching(bundlePath);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('esbuild external require not found');
  });

  it('fails when esbuild-wasm external require is missing', () => {
    writeFileSync(
      bundlePath,
      'phc_key; require("esbuild"); no wasm require here',
    );
    const result = runCatching(bundlePath);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('esbuild-wasm external require not found');
  });

  it('passes when bundle is valid', () => {
    writeFileSync(bundlePath, validBundle);
    const result = runCatching(bundlePath);
    expect(result.exitCode).toBe(0);
  });
});
