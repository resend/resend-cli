import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import {
  setNonInteractive,
  mockExitThrow,
  captureTestEnv,
  setupOutputSpies,
  expectExit1,
} from '../../helpers';

const mockCreate = mock(async () => ({
  data: { object: 'segment' as const, id: 'seg_abc123', name: 'Newsletter Subscribers' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    segments = { create: mockCreate };
  },
}));

describe('segments create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    spies?.restore();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  test('creates segment with --name flag', async () => {
    spies = setupOutputSpies();

    const { createSegmentCommand } = await import('../../../src/commands/segments/create');
    await createSegmentCommand.parseAsync(['--name', 'Newsletter Subscribers'], { from: 'user' });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as any;
    expect(args.name).toBe('Newsletter Subscribers');
  });

  test('outputs JSON with id and object when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createSegmentCommand } = await import('../../../src/commands/segments/create');
    await createSegmentCommand.parseAsync(['--name', 'Newsletter Subscribers'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('segment');
    expect(parsed.id).toBe('seg_abc123');
    expect(parsed.name).toBe('Newsletter Subscribers');
  });

  test('errors with missing_name in non-interactive mode when --name absent', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createSegmentCommand } = await import('../../../src/commands/segments/create');
    await expectExit1(() => createSegmentCommand.parseAsync([], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  test('does not call SDK when missing_name error is raised', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createSegmentCommand } = await import('../../../src/commands/segments/create');
    await expectExit1(() => createSegmentCommand.parseAsync([], { from: 'user' }));

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createSegmentCommand } = await import('../../../src/commands/segments/create');
    await expectExit1(() => createSegmentCommand.parseAsync(['--name', 'Test'], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce({ data: null, error: { message: 'Segment already exists', name: 'validation_error' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createSegmentCommand } = await import('../../../src/commands/segments/create');
    await expectExit1(() => createSegmentCommand.parseAsync(['--name', 'Newsletter Subscribers'], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
