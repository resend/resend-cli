import { describe, test, expect, spyOn, afterEach, mock, beforeEach } from 'bun:test';
import {
  setNonInteractive,
  mockExitThrow,
  captureTestEnv,
  setupOutputSpies,
  expectExit1,
} from '../../helpers';

const mockGet = mock(async () => ({
  data: {
    object: 'segment' as const,
    id: 'seg_abc123',
    name: 'Newsletter Subscribers',
    created_at: '2026-01-01T00:00:00.000Z',
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    segments = { get: mockGet };
  },
}));

describe('segments get command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockGet.mockClear();
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

  test('calls SDK with the provided segment ID', async () => {
    spies = setupOutputSpies();

    const { getSegmentCommand } = await import('../../../src/commands/segments/get');
    await getSegmentCommand.parseAsync(['seg_abc123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('seg_abc123');
  });

  test('outputs JSON segment data when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getSegmentCommand } = await import('../../../src/commands/segments/get');
    await getSegmentCommand.parseAsync(['seg_abc123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('segment');
    expect(parsed.id).toBe('seg_abc123');
    expect(parsed.name).toBe('Newsletter Subscribers');
    expect(parsed.created_at).toBe('2026-01-01T00:00:00.000Z');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getSegmentCommand } = await import('../../../src/commands/segments/get');
    await expectExit1(() => getSegmentCommand.parseAsync(['seg_abc123'], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce({ data: null, error: { message: 'Segment not found', name: 'not_found' } } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getSegmentCommand } = await import('../../../src/commands/segments/get');
    await expectExit1(() => getSegmentCommand.parseAsync(['seg_nonexistent'], { from: 'user' }));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
