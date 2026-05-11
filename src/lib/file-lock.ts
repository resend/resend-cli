import {
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { dirname } from 'node:path';

const LOCK_STALE_MS = 10_000;
const LOCK_RETRY_INTERVAL_MS = 50;
const LOCK_MAX_RETRIES = 200;

export function withFileLock<T>(lockPath: string, fn: () => T): T;
export function withFileLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
): Promise<T>;
export function withFileLock<T>(
  lockPath: string,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  mkdirSync(dirname(lockPath), { recursive: true });
  const ownedIno = acquireLock(lockPath);
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => releaseLock(lockPath, ownedIno));
    }
    releaseLock(lockPath, ownedIno);
    return result;
  } catch (err) {
    releaseLock(lockPath, ownedIno);
    throw err;
  }
}

const acquireLock = (lockPath: string): number => {
  for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
    try {
      const fd = openSync(lockPath, 'wx');
      try {
        return fstatSync(fd).ino;
      } finally {
        closeSync(fd);
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
      if (isLockStale(lockPath)) {
        try {
          unlinkSync(lockPath);
        } catch {
          /* best-effort */
        }
        continue;
      }
      sleepSync(LOCK_RETRY_INTERVAL_MS);
    }
  }
  throw new Error(
    `Could not acquire lock on ${lockPath} after ${LOCK_MAX_RETRIES} retries. ` +
      `If no other resend process is running, delete the lock file manually.`,
  );
};

// Only unlink the lock file we created. If our lock was stolen via stale
// detection by another process, its inode will differ and we leave it alone.
const releaseLock = (lockPath: string, ownedIno: number): void => {
  try {
    const stat = statSync(lockPath);
    if (stat.ino !== ownedIno) {
      return;
    }
    unlinkSync(lockPath);
  } catch {
    /* best-effort */
  }
};

const isLockStale = (lockPath: string): boolean => {
  try {
    const stat = statSync(lockPath);
    return Date.now() - stat.mtimeMs > LOCK_STALE_MS;
  } catch {
    return true;
  }
};

const sleepSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};
