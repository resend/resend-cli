import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { listSuppressionsCommand } from '../../../src/commands/suppressions/list';
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
    object: 'list',
    data: [
      {
        object: 'suppression',
        id: 'sup-1',
        email: 'spam@example.com',
        origin: 'bounce',
        source_id: 'evt-1',
        created_at: '2026-01-01 00:00:00+00',
      },
      {
        object: 'suppression',
        id: 'sup-2',
        email: 'complaint@example.com',
        origin: 'manual',
        source_id: null,
        created_at: '2026-01-02 00:00:00+00',
      },
    ],
    has_more: false,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    suppressions = { list: mockList };
  },
}));

describe('suppressions list command', () => {
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

  function getFirstCallArgs(): unknown {
    const firstCall = mockList.mock.calls.at(0);
    if (!firstCall) {
      throw new Error('Expected mockList to be called at least once');
    }
    return firstCall[0];
  }

  it('uses default limit of 10 when not specified', async () => {
    spies = setupOutputSpies();
    await listSuppressionsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    expect(getFirstCallArgs()).toMatchObject({ limit: 10 });
  });

  it('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();
    await listSuppressionsCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0].email).toBe('spam@example.com');
  });

  it('passes origin filter to SDK', async () => {
    spies = setupOutputSpies();
    await listSuppressionsCommand.parseAsync(['--origin', 'bounce'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({ origin: 'bounce' });
  });

  it('rejects an invalid origin value', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expect(
      listSuppressionsCommand.parseAsync(['--origin', 'nope'], {
        from: 'user',
      }),
    ).rejects.toThrow();

    expect(mockList).not.toHaveBeenCalled();
  });

  it('passes after cursor to SDK', async () => {
    spies = setupOutputSpies();
    await listSuppressionsCommand.parseAsync(['--after', 'cur'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({ after: 'cur' });
  });

  it('preserves --origin in the next-page hint', async () => {
    mockList.mockResolvedValueOnce({
      data: {
        object: 'list',
        data: [
          {
            object: 'suppression',
            id: 'sup-1',
            email: 'spam@example.com',
            origin: 'bounce',
            source_id: 'evt-1',
            created_at: '2026-01-01 00:00:00+00',
          },
        ],
        has_more: true,
      },
      error: null,
    });
    // Interactive mode: the hint only prints when TTY and not a CI env.
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.TERM;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await listSuppressionsCommand.parseAsync(['--origin', 'bounce'], {
      from: 'user',
    });

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    logSpy.mockRestore();
    expect(output).toContain('--origin bounce');
  });

  it('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(
      mockSdkError('Unauthorized', 'unauthorized'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      listSuppressionsCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
