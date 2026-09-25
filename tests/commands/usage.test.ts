import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { usageCommand } from '../../src/commands/usage';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../helpers';

const mockUsageGet = vi.fn(async () => ({
  data: {
    object: 'usage',
    emails: {
      daily: {
        used: 258,
        limit: null,
        sent: 57,
        received: 201,
        resets_at: '2026-07-17T00:00:00.000Z',
      },
      monthly: {
        used: 5442,
        limit: 10000,
        sent: 1000,
        received: 4442,
        resets_at: '2026-08-01T00:00:00.000Z',
      },
    },
    contacts: { used: 85000, limit: 150000 },
    segments: { used: 2, limit: 3 },
    broadcasts: { used: 100, limit: null },
    ai_credits: {
      used: 0,
      limit: 500,
      next_increase_at: '2026-07-18T09:00:00.000Z',
    },
    automation_runs: {
      used: 0,
      limit: 1000,
      resets_at: '2026-08-01T00:00:00.000Z',
    },
    domains: { used: 1, limit: 1000 },
    rate_limit: { limit: 10, duration: '1000ms' },
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    usage = { get: mockUsageGet };
  },
}));

describe('usage command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUsageGet.mockClear();
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

  it('calls the SDK with no arguments', async () => {
    spies = setupOutputSpies();

    await usageCommand.parseAsync([], { from: 'user' });

    expect(mockUsageGet).toHaveBeenCalledWith();
  });

  it('outputs JSON in non-interactive mode', async () => {
    spies = setupOutputSpies();

    await usageCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('usage');
    expect(parsed.emails.daily.used).toBe(258);
    expect(parsed.emails.daily.limit).toBeNull();
    expect(parsed.emails.monthly.limit).toBe(10000);
    expect(parsed.rate_limit).toEqual({ limit: 10, duration: '1000ms' });
  });

  it('surfaces an API error with fetch_error', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();
    mockUsageGet.mockResolvedValueOnce(
      mockSdkError('Something went wrong') as never,
    );

    await expectExit1(() => usageCommand.parseAsync([], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
