import {
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withFileLock } from '../../src/lib/file-lock';

describe('withFileLock', () => {
  let tmpDir: string;
  let lockPath: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `lock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
    lockPath = join(tmpDir, 'subject.lock');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs the body and releases the lock on success', () => {
    let ran = false;
    const result = withFileLock(lockPath, () => {
      ran = true;
      expect(existsSync(lockPath)).toBe(true);
      return 42;
    });
    expect(ran).toBe(true);
    expect(result).toBe(42);
    expect(existsSync(lockPath)).toBe(false);
  });

  it('releases the lock when the body throws', () => {
    expect(() =>
      withFileLock(lockPath, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('supports async bodies and releases on resolve', async () => {
    const result = await withFileLock(lockPath, async () => {
      expect(existsSync(lockPath)).toBe(true);
      await Promise.resolve();
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('releases the lock when an async body rejects', async () => {
    await expect(
      withFileLock(lockPath, async () => {
        await Promise.resolve();
        throw new Error('async boom');
      }),
    ).rejects.toThrow('async boom');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('reclaims a stale lock and runs the body', () => {
    writeFileSync(lockPath, '');
    const pastSeconds = (Date.now() - 30_000) / 1000;
    utimesSync(lockPath, pastSeconds, pastSeconds);

    let ran = false;
    withFileLock(lockPath, () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  });

  it('does not unlink a lock that was stolen by another holder', () => {
    let stolenLockExists = false;
    withFileLock(lockPath, () => {
      unlinkSync(lockPath);
      writeFileSync(lockPath, 'other');
      stolenLockExists = existsSync(lockPath);
    });
    expect(stolenLockExists).toBe(true);
    // The stolen lock survives release because its inode is different.
    expect(existsSync(lockPath)).toBe(true);
  });
});
