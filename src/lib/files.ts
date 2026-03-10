import { readFileSync } from 'node:fs';
import type { GlobalOpts } from './client';
import { outputError } from './output';

/** Read a text file, exiting with file_read_error if unreadable. */
export function readFile(filePath: string, globalOpts: GlobalOpts): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    outputError(
      { message: `Failed to read file: ${filePath}`, code: 'file_read_error' },
      { json: globalOpts.json },
    );
  }
}
