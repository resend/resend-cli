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

const mockGet = vi.fn(async () => ({
  data: {
    object: 'segment' as const,
    id: '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
    name: 'Newsletter Subscribers',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    segments = { get: mockGet };
  },
}));

describe('segments get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
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

  test('calls SDK with the provided segment ID', async () => {
    spies = setupOutputSpies();

    const { getSegmentCommand } = await import(
      '../../../src/commands/segments/get'
    );
    await getSegmentCommand.parseAsync(
      ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c'],
      { from: 'user' },
    );

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe(
      '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
    );
  });

  test('outputs JSON segment data when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getSegmentCommand } = await import(
      '../../../src/commands/segments/get'
    );
    await getSegmentCommand.parseAsync(
      ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('segment');
    expect(parsed.id).toBe('3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c');
    expect(parsed.name).toBe('Newsletter Subscribers');
    expect(parsed.created_at).toBe('2026-01-01T00:00:00.000Z');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getSegmentCommand } = await import(
      '../../../src/commands/segments/get'
    );
    await expectExit1(() =>
      getSegmentCommand.parseAsync(['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(
      mockSdkError('Segment not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getSegmentCommand } = await import(
      '../../../src/commands/segments/get'
    );
    await expectExit1(() =>
      getSegmentCommand.parseAsync(['00000000-0000-0000-0000-000000000000'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
