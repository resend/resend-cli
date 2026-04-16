import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockBuild = vi.fn(
  async (opts: { outdir: string; entryPoints: string[] }) => {
    const name = path.basename(
      opts.entryPoints[0],
      path.extname(opts.entryPoints[0]),
    );
    writeFileSync(path.join(opts.outdir, `${name}.cjs`), 'module.exports = {}');
  },
);

vi.mock('../../src/lib/esbuild/load-esbuild', () => ({
  loadEsbuild: () => ({ build: mockBuild }),
}));

const { bundleReactEmail } = await import('../../src/lib/react-email-bundler');

const createdDirs: string[] = [];

afterEach(() => {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  createdDirs.length = 0;
  mockBuild.mockClear();
});

describe('bundleReactEmail', () => {
  it('returns cjsPath and tmpDir for a valid template path', async () => {
    const result = await bundleReactEmail('/fake/test-email.tsx');
    createdDirs.push(result.tmpDir);

    expect(result.cjsPath).toContain('test-email.cjs');
    expect(result.tmpDir).toBeTruthy();
    expect(existsSync(result.cjsPath)).toBe(true);
    expect(readFileSync(result.cjsPath, 'utf8')).toBe('module.exports = {}');
  });

  it('calls esbuild.build with correct options', async () => {
    const result = await bundleReactEmail('/fake/welcome.tsx');
    createdDirs.push(result.tmpDir);

    expect(mockBuild).toHaveBeenCalledTimes(1);
    const opts = mockBuild.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.bundle).toBe(true);
    expect(opts.format).toBe('cjs');
    expect(opts.jsx).toBe('automatic');
    expect(opts.platform).toBe('node');
  });

  it('cleans up tmpDir on build failure', async () => {
    const before = readdirSync(tmpdir()).filter((d) =>
      d.startsWith('resend-react-email-'),
    );

    mockBuild.mockRejectedValueOnce(new Error('build failed'));

    await expect(bundleReactEmail('/fake/broken.tsx')).rejects.toThrow(
      'build failed',
    );

    const after = readdirSync(tmpdir()).filter((d) =>
      d.startsWith('resend-react-email-'),
    );
    expect(after.length).toBe(before.length);
  });

  it('produces a cjs output path named after the input', async () => {
    const result = await bundleReactEmail('/fake/welcome.tsx');
    createdDirs.push(result.tmpDir);

    expect(path.basename(result.cjsPath)).toBe('welcome.cjs');
  });

  it('creates tmpDir inside os tmpdir with resend prefix', async () => {
    const result = await bundleReactEmail('/fake/email.tsx');
    createdDirs.push(result.tmpDir);

    expect(result.tmpDir).toContain('resend-react-email-');
  });
});
