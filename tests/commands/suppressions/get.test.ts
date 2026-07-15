import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
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
    object: 'suppression',
    id: 'sup-1',
    email: 'spam@example.com',
    origin: 'bounce',
    source_id: 'evt-1',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    suppressions = { get: mockGet };
  },
}));

describe('suppressions get command', () => {
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

  it('fetches by email argument', async () => {
    spies = setupOutputSpies();
    const { getSuppressionCommand } = await import(
      '../../../src/commands/suppressions/get'
    );
    await getSuppressionCommand.parseAsync(['spam@example.com'], {
      from: 'user',
    });

    expect(mockGet).toHaveBeenCalledWith('spam@example.com');
  });

  it('fetches by id argument', async () => {
    spies = setupOutputSpies();
    const { getSuppressionCommand } = await import(
      '../../../src/commands/suppressions/get'
    );
    await getSuppressionCommand.parseAsync(['sup-1'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledWith('sup-1');
  });

  it('outputs the suppression JSON when non-interactive', async () => {
    spies = setupOutputSpies();
    const { getSuppressionCommand } = await import(
      '../../../src/commands/suppressions/get'
    );
    await getSuppressionCommand.parseAsync(['spam@example.com'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.email).toBe('spam@example.com');
    expect(parsed.origin).toBe('bounce');
  });

  it('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(mockSdkError('Not found', 'not_found'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getSuppressionCommand } = await import(
      '../../../src/commands/suppressions/get'
    );
    await expectExit1(() =>
      getSuppressionCommand.parseAsync(['sup-1'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
