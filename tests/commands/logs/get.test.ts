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
    object: 'log' as const,
    id: '3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55',
    created_at: '2024-11-01T18:10:00.000Z',
    endpoint: '/emails',
    method: 'POST',
    response_status: 200,
    user_agent: 'resend-node:4.0.0',
    request_body: { from: 'user@example.com', to: 'recipient@example.com' },
    response_body: { id: 'email_123' },
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    logs = { get: mockGet };
  },
}));

describe('logs get command', () => {
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

  test('calls SDK get with the provided id', async () => {
    spies = setupOutputSpies();

    const { getLogCommand } = await import('../../../src/commands/logs/get');
    await getLogCommand.parseAsync(['3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55'], {
      from: 'user',
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe(
      '3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55',
    );
  });

  test('outputs JSON with log fields when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getLogCommand } = await import('../../../src/commands/logs/get');
    await getLogCommand.parseAsync(['3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55');
    expect(parsed.endpoint).toBe('/emails');
    expect(parsed.method).toBe('POST');
    expect(parsed.response_status).toBe(200);
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getLogCommand } = await import('../../../src/commands/logs/get');
    await expectExit1(() =>
      getLogCommand.parseAsync(['3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(mockSdkError('Not found', 'not_found'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getLogCommand } = await import('../../../src/commands/logs/get');
    await expectExit1(() =>
      getLogCommand.parseAsync(['nonexistent-id'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
