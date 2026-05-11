import {
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';

export const writeFileAtomic = (
  filePath: string,
  data: string,
  mode: number,
): void => {
  const tmpPath = `${filePath}.tmp.${process.pid}`;

  try {
    const fd = openSync(tmpPath, 'w', mode);
    try {
      writeSync(fd, data);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmpPath, filePath);
    fsyncDir(dirname(filePath));
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* cleanup is best-effort */
    }
    throw err;
  }
};

// POSIX guarantees rename atomicity across crash boundaries only after
// the parent directory is also fsynced. On Windows fsync of a directory
// is not supported and openSync('w') would fail anyway, so we skip it.
const fsyncDir = (dirPath: string): void => {
  if (process.platform === 'win32') {
    return;
  }
  try {
    const dirFd = openSync(dirPath, 'r');
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
  } catch {
    /* best-effort — some filesystems return EINVAL on dir fsync */
  }
};
