import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { metricsCommand } from '../../../src/commands/emails/metrics';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockMetrics = vi.fn(async () => ({
  data: {
    object: 'metrics',
    start_date: '2026-07-01T00:00:00.000Z',
    end_date: '2026-07-08T00:00:00.000Z',
    metrics: ['sent', 'delivered'],
    dimensions: [],
    granularity: 'daily',
    totals: { sent: 100, delivered: 95 },
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { metrics: mockMetrics };
  },
}));

describe('emails metrics command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockMetrics.mockClear();
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

  it('calls SDK metrics with no options by default', async () => {
    spies = setupOutputSpies();

    await metricsCommand.parseAsync([], { from: 'user' });

    expect(mockMetrics).toHaveBeenCalledWith({
      startDate: undefined,
      endDate: undefined,
      timezone: undefined,
      granularity: undefined,
      metrics: undefined,
      dimensions: undefined,
      domainId: undefined,
      emailId: undefined,
      broadcastId: undefined,
    });
  });

  it('parses comma-separated dimensions and a filter into arrays', async () => {
    spies = setupOutputSpies();

    await metricsCommand.parseAsync(
      ['--dimensions', 'period,broadcast', '--broadcast-id', 'b1,b2'],
      { from: 'user' },
    );

    expect(mockMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        dimensions: ['period', 'broadcast'],
        broadcastId: ['b1', 'b2'],
      }),
    );
  });

  it('outputs JSON in non-interactive mode', async () => {
    spies = setupOutputSpies();

    await metricsCommand.parseAsync([], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('metrics');
    expect(parsed.totals.sent).toBe(100);
  });

  it('rejects combining the email and broadcast dimensions, without calling the SDK', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      metricsCommand.parseAsync(['--dimensions', 'email,broadcast'], {
        from: 'user',
      }),
    );

    expect(mockMetrics).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  it('rejects emailId and broadcastId combined, without calling the SDK', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      metricsCommand.parseAsync(['--email-id', 'e1', '--broadcast-id', 'b1'], {
        from: 'user',
      }),
    );

    expect(mockMetrics).not.toHaveBeenCalled();
  });

  it('rejects an empty --email-id combined with --broadcast-id, without calling the SDK', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      metricsCommand.parseAsync(['--email-id', '', '--broadcast-id', 'b1'], {
        from: 'user',
      }),
    );

    expect(mockMetrics).not.toHaveBeenCalled();
    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });
});
