import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectExit1, mockExitThrow } from '../helpers';

const globalOpts = { json: false, apiKey: undefined };
const jsonOpts = { json: true, apiKey: undefined };

describe('readFile', () => {
  const tmpFile = join(import.meta.dir, 'tmp-test.txt');
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  afterEach(() => {
    errorSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy?.mockRestore();
    exitSpy = undefined;
    try {
      unlinkSync(tmpFile);
    } catch {
      /* already removed */
    }
  });

  test('reads file content and returns it as a string', () => {
    writeFileSync(tmpFile, '<h1>Hello</h1>', 'utf-8');
    const { readFile } = require('../../src/lib/files');
    const content = readFile(tmpFile, globalOpts);
    expect(content).toBe('<h1>Hello</h1>');
  });

  test('reads JSON file content and returns it as a string', () => {
    writeFileSync(tmpFile, '[{"id":1}]', 'utf-8');
    const { readFile } = require('../../src/lib/files');
    const content = readFile(tmpFile, globalOpts);
    expect(content).toBe('[{"id":1}]');
  });

  test('exits with file_read_error when file does not exist', async () => {
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { readFile } = require('../../src/lib/files');
    await expectExit1(async () =>
      readFile('/nonexistent/path/data.txt', globalOpts),
    );

    const output = errorSpy?.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('Failed to read file:');
  });

  test('outputs JSON error with file_read_error code when json option is true', async () => {
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { readFile } = require('../../src/lib/files');
    await expectExit1(async () => readFile('/nonexistent/file.txt', jsonOpts));

    const raw = errorSpy?.mock.calls.map((c) => c[0]).join(' ');
    const parsed = JSON.parse(raw);
    expect(parsed.error.code).toBe('file_read_error');
    expect(parsed.error.message).toContain('Failed to read file:');
  });
});
