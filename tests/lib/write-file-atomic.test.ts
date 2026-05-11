import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileAtomic } from '../../src/lib/write-file-atomic';

const isWindows = process.platform === 'win32';

describe('writeFileAtomic', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `wfa-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the file with the requested content', () => {
    const target = join(tmpDir, 'creds.json');
    writeFileAtomic(target, '{"hello":"world"}\n', 0o600);
    expect(readFileSync(target, 'utf-8')).toBe('{"hello":"world"}\n');
  });

  // Unix permission bits are a no-op on Windows.
  it.skipIf(isWindows)('applies the requested file mode', () => {
    const target = join(tmpDir, 'creds.json');
    writeFileAtomic(target, '{"hello":"world"}\n', 0o600);
    expect(statSync(target).mode & 0o777).toBe(0o600);
  });

  it('overwrites an existing file', () => {
    const target = join(tmpDir, 'creds.json');
    writeFileSync(target, 'old');
    writeFileAtomic(target, 'new', 0o600);
    expect(readFileSync(target, 'utf-8')).toBe('new');
  });

  it('does not leave a tmp file behind after a successful write', () => {
    const target = join(tmpDir, 'creds.json');
    writeFileAtomic(target, 'x', 0o600);
    const leftover = readdirSync(tmpDir).filter((f) => f.includes('.tmp.'));
    expect(leftover).toEqual([]);
  });

  it('throws and removes the tmp file when the destination directory is missing', () => {
    const target = join(tmpDir, 'does-not-exist', 'creds.json');
    expect(() => writeFileAtomic(target, 'x', 0o600)).toThrow();
    // The tmp would have been in the same missing directory, so nothing to leak.
    expect(readdirSync(tmpDir)).toEqual([]);
  });

  // chmod is the easiest way to force a rename failure under POSIX. On
  // Windows the Unix mode bits are ignored, so we skip this test there;
  // the "tmp file cleanup on rename failure" path is otherwise hard to
  // trigger without a more elaborate setup.
  it.skipIf(isWindows)('does not leak a tmp file when rename fails', () => {
    const target = join(tmpDir, 'creds.json');
    writeFileSync(target, 'existing');
    chmodSync(tmpDir, 0o500);
    try {
      writeFileAtomic(target, 'replacement', 0o600);
    } catch {
      /* expected */
    } finally {
      chmodSync(tmpDir, 0o700);
    }
    const leftover = readdirSync(tmpDir).filter((f) => f.includes('.tmp.'));
    expect(leftover).toEqual([]);
  });
});
