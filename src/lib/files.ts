import { readFileSync } from 'node:fs';
import type { GlobalOpts } from './client';
import { outputError } from './output';

/** Read a text file (or stdin when filePath is "-"), exiting on error. */
export function readFile(filePath: string, globalOpts: GlobalOpts): string {
  if (filePath === '-') {
    if (process.stdin.isTTY) {
      outputError(
        {
          message: 'No input piped to stdin',
          code: 'stdin_read_error',
        },
        { json: globalOpts.json },
      );
    }
    try {
      return readFileSync(0, 'utf-8');
    } catch {
      outputError(
        { message: 'Failed to read from stdin', code: 'stdin_read_error' },
        { json: globalOpts.json },
      );
    }
  }
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    outputError(
      { message: `Failed to read file: ${filePath}`, code: 'file_read_error' },
      { json: globalOpts.json },
    );
  }
}
