import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockGet = mock(async () => ({
  data: {
    object: 'broadcast' as const,
    id: 'bcast_abc123',
    name: 'Weekly Newsletter',
    segment_id: 'seg_123',
    audience_id: null,
    from: 'hello@domain.com',
    subject: 'This week in Resend',
    reply_to: null,
    preview_text: 'Read what is new',
    html: '<p>Hi</p>',
    text: null,
    status: 'sent' as const,
    created_at: '2026-02-18T12:00:00.000Z',
    scheduled_at: null,
    sent_at: '2026-02-18T12:05:00.000Z',
    topic_id: null,
  },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { get: mockGet };
  },
}));

describe('broadcasts get command', () => {
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

  test('fetches broadcast by id', async () => {
    spies = setupOutputSpies();

    const { getBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/get'
    );
    await getBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('bcast_abc123');
  });

  test('outputs full JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/get'
    );
    await getBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('bcast_abc123');
    expect(parsed.status).toBe('sent');
    expect(parsed.subject).toBe('This week in Resend');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/get'
    );
    await expectExit1(() =>
      getBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with fetch_error when SDK returns an error', async () => {
    setNonInteractive();
    mockGet.mockResolvedValueOnce(mockSdkError('Not found', 'not_found'));
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { getBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/get'
    );
    await expectExit1(() =>
      getBroadcastCommand.parseAsync(['bcast_bad'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
