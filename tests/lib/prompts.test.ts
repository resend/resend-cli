import {
  afterEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import { expectExit1, mockExitThrow } from '../helpers';

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;
let errorSpy: MockInstance | undefined;
let exitSpy: MockInstance | undefined;

function setTTY(value: boolean | undefined) {
  Object.defineProperty(process.stdin, 'isTTY', { value, writable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value, writable: true });
}

function setupSpies() {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  exitSpy = mockExitThrow();
}

function spyOutput(): string {
  return errorSpy?.mock.calls.map((c) => c[0]).join(' ') ?? '';
}

afterEach(() => {
  errorSpy?.mockRestore();
  exitSpy?.mockRestore();
  errorSpy = undefined;
  exitSpy = undefined;
  Object.defineProperty(process.stdin, 'isTTY', {
    value: originalStdinIsTTY,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    value: originalStdoutIsTTY,
    writable: true,
  });
});

describe('promptForMissing', () => {
  test('returns options unchanged when nothing is missing', async () => {
    const { promptForMissing } = await import('../../src/lib/prompts');
    const opts = { from: 'a@b.com', to: 'c@d.com', subject: 'Hi' };
    const result = await promptForMissing(
      opts,
      [
        { flag: 'from', message: 'From' },
        { flag: 'to', message: 'To' },
        { flag: 'subject', message: 'Subject' },
      ],
      {},
    );
    expect(result).toEqual(opts);
  });

  test('exits with missing_flags error in non-interactive mode', async () => {
    setTTY(undefined);
    setupSpies();

    const { promptForMissing } = await import('../../src/lib/prompts');

    await expectExit1(() =>
      promptForMissing(
        { from: undefined, to: 'c@d.com', subject: undefined },
        [
          { flag: 'from', message: 'From' },
          { flag: 'to', message: 'To' },
          { flag: 'subject', message: 'Subject' },
        ],
        {},
      ),
    );

    expect(spyOutput()).toContain('--from');
    expect(spyOutput()).toContain('--subject');
    // --to should NOT be listed since it has a value
    expect(spyOutput()).not.toContain('--to,');
  });

  test('errors output includes missing_flags code', async () => {
    setTTY(undefined);
    setupSpies();

    const { promptForMissing } = await import('../../src/lib/prompts');

    await expectExit1(() =>
      promptForMissing(
        { from: undefined },
        [{ flag: 'from', message: 'From' }],
        {},
      ),
    );

    expect(spyOutput()).toContain('missing_flags');
  });

  test('exits with missing_flags error when --json is set even in TTY', async () => {
    setTTY(true);
    setupSpies();

    const { promptForMissing } = await import('../../src/lib/prompts');

    await expectExit1(() =>
      promptForMissing(
        { from: undefined },
        [{ flag: 'from', message: 'From' }],
        { json: true },
      ),
    );

    expect(spyOutput()).toContain('missing_flags');
  });

  test('skips fields marked as required=false', async () => {
    const { promptForMissing } = await import('../../src/lib/prompts');
    const opts = { from: 'a@b.com', to: undefined };
    const result = await promptForMissing(
      opts,
      [
        { flag: 'from', message: 'From' },
        { flag: 'to', message: 'To', required: false },
      ],
      {},
    );
    expect(result).toEqual(opts);
  });
});

describe('pickId', () => {
  test('returns id immediately when provided', async () => {
    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId('test-id', {} as never, {});
    expect(result).toBe('test-id');
  });

  test('exits with missing_id error in non-interactive mode', async () => {
    setTTY(undefined);
    setupSpies();

    const { pickId } = await import('../../src/lib/prompts');

    await expectExit1(() => pickId(undefined, {} as never, {}));

    expect(spyOutput()).toContain('missing_id');
  });

  test('exits with missing_id error when --json is set even in TTY', async () => {
    setTTY(true);
    setupSpies();

    const { pickId } = await import('../../src/lib/prompts');

    await expectExit1(() => pickId(undefined, {} as never, { json: true }));

    const parsed = JSON.parse(spyOutput());
    expect(parsed.error.code).toBe('missing_id');
  });

  test('returns undefined in non-interactive mode when optional', async () => {
    setTTY(undefined);

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(undefined, {} as never, {}, { optional: true });
    expect(result).toBeUndefined();
  });

  test('returns undefined when --json is set and optional', async () => {
    setTTY(true);

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(
      undefined,
      {} as never,
      { json: true },
      { optional: true },
    );
    expect(result).toBeUndefined();
  });

  test('returns id immediately when provided and optional', async () => {
    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId('test-id', {} as never, {}, { optional: true });
    expect(result).toBe('test-id');
  });
});

describe('confirmDelete', () => {
  test('exits with confirmation_required when non-interactive', async () => {
    setTTY(undefined);
    setupSpies();

    const { confirmDelete } = await import('../../src/lib/prompts');

    await expectExit1(() =>
      confirmDelete('res_123', 'Delete resource res_123?', { json: false }),
    );

    expect(spyOutput()).toContain('confirmation_required');
  });

  test('outputs JSON confirmation_required error when json option is true', async () => {
    setTTY(undefined);
    setupSpies();

    const { confirmDelete } = await import('../../src/lib/prompts');
    await expectExit1(() =>
      confirmDelete('res_123', 'Delete?', { json: true }),
    );

    const parsed = JSON.parse(spyOutput());
    expect(parsed.error.code).toBe('confirmation_required');
  });

  test('exits with confirmation_required when --json is set even in TTY', async () => {
    setTTY(true);
    setupSpies();

    const { confirmDelete } = await import('../../src/lib/prompts');
    await expectExit1(() =>
      confirmDelete('res_123', 'Delete?', { json: true }),
    );

    const parsed = JSON.parse(spyOutput());
    expect(parsed.error.code).toBe('confirmation_required');
  });
});
