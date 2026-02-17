import { describe, test, expect, spyOn, afterEach } from 'bun:test';

// Custom error to detect process.exit calls without actually exiting
class ExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
  }
}

describe('promptForMissing', () => {
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;
  let errorSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
  });

  test('returns options unchanged when nothing is missing', async () => {
    const { promptForMissing } = require('../../src/lib/prompts');
    const opts = { from: 'a@b.com', to: 'c@d.com', subject: 'Hi' };
    const result = await promptForMissing(opts, [
      { flag: 'from', message: 'From' },
      { flag: 'to', message: 'To' },
      { flag: 'subject', message: 'Subject' },
    ]);
    expect(result).toEqual(opts);
  });

  test('exits with error listing missing flags in non-interactive mode', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, writable: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new ExitError(code ?? 0);
    });

    const { promptForMissing } = require('../../src/lib/prompts');

    try {
      await promptForMissing(
        { from: undefined, to: 'c@d.com', subject: undefined },
        [
          { flag: 'from', message: 'From' },
          { flag: 'to', message: 'To' },
          { flag: 'subject', message: 'Subject' },
        ]
      );
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(ExitError);
      expect((err as ExitError).code).toBe(1);
    }

    const allErrors = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(allErrors).toContain('--from');
    expect(allErrors).toContain('--subject');
    // --to should NOT be listed since it has a value
    expect(allErrors).not.toContain('--to,');
  });

  test('skips fields marked as required=false', async () => {
    const { promptForMissing } = require('../../src/lib/prompts');
    const opts = { from: 'a@b.com', to: undefined };
    const result = await promptForMissing(opts, [
      { flag: 'from', message: 'From' },
      { flag: 'to', message: 'To', required: false },
    ]);
    expect(result).toEqual(opts);
  });
});
