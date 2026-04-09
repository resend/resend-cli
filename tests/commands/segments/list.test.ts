import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    data: [
      {
        id: '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
        name: 'Newsletter Subscribers',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    has_more: false,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    segments = { list: mockList };
  },
}));

describe('segments list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
  });

  test('calls SDK with default limit of 10', async () => {
    spies = setupOutputSpies();

    const { listSegmentsCommand } = await import(
      '../../../src/commands/segments/list'
    );
    await listSegmentsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(10);
  });

  test('calls SDK with custom --limit', async () => {
    spies = setupOutputSpies();

    const { listSegmentsCommand } = await import(
      '../../../src/commands/segments/list'
    );
    await listSegmentsCommand.parseAsync(['--limit', '25'], { from: 'user' });

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(25);
  });

  test('calls SDK with --after cursor', async () => {
    spies = setupOutputSpies();

    const { listSegmentsCommand } = await import(
      '../../../src/commands/segments/list'
    );
    await listSegmentsCommand.parseAsync(['--after', 'cursor_xyz'], {
      from: 'user',
    });

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.after).toBe('cursor_xyz');
  });

  test('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listSegmentsCommand } = await import(
      '../../../src/commands/segments/list'
    );
    await listSegmentsCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data[0].name).toBe('Newsletter Subscribers');
    expect(parsed.has_more).toBe(false);
  });

  test('errors with invalid_limit when --limit is out of range', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listSegmentsCommand } = await import(
      '../../../src/commands/segments/list'
    );
    await expectExit1(() =>
      listSegmentsCommand.parseAsync(['--limit', '0'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_limit');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listSegmentsCommand } = await import(
      '../../../src/commands/segments/list'
    );
    await expectExit1(() =>
      listSegmentsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Server error', 'server_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listSegmentsCommand } = await import(
      '../../../src/commands/segments/list'
    );
    await expectExit1(() =>
      listSegmentsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
