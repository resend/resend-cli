import {
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';

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
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* cleanup is best-effort */
    }
    throw err;
  }
};
