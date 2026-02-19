import { readFileSync } from 'node:fs';
import type { GlobalOpts } from './client';
import { outputError } from './output';

function readFileContent(filePath: string, errorMsg: string, globalOpts: GlobalOpts): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    outputError(
      { message: errorMsg, code: 'file_read_error' },
      { json: globalOpts.json }
    );
  }
}

/** Read an HTML file, exiting with file_read_error if unreadable. */
export function readHtmlFile(filePath: string, globalOpts: GlobalOpts): string {
  return readFileContent(filePath, `Failed to read HTML file: ${filePath}`, globalOpts);
}

/** Read any text file, exiting with file_read_error if unreadable. */
export function readFile(filePath: string, globalOpts: GlobalOpts): string {
  return readFileContent(filePath, `Failed to read file: ${filePath}`, globalOpts);
}
