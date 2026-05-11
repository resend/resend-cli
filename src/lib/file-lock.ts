import { closeSync, mkdirSync, openSync, statSync, unlinkSync } from 'node:fs';
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
  acquireLock(lockPath);
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => releaseLock(lockPath));
    }
    releaseLock(lockPath);
    return result;
  } catch (err) {
    releaseLock(lockPath);
    throw err;
  }
}

const acquireLock = (lockPath: string): void => {
  for (let attempt = 0; attempt < LOCK_MAX_RETRIES; attempt++) {
    try {
      const fd = openSync(lockPath, 'wx');
      closeSync(fd);
      return;
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
    `Could not acquire lock on ${lockPath} after ${LOCK_MAX_RETRIES} retries`,
  );
};

const releaseLock = (lockPath: string): void => {
  try {
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
