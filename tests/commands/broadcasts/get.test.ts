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
    object: 'broadcast' as const,
    id: 'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    name: 'Weekly Newsletter',
    segment_id: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
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

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { get: mockGet };
  },
}));

describe('broadcasts get command', () => {
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

  test('fetches broadcast by id', async () => {
    spies = setupOutputSpies();

    const { getBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/get'
    );
    await getBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe(
      'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
  });

  test('outputs full JSON when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/get'
    );
    await getBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(parsed.status).toBe('sent');
    expect(parsed.subject).toBe('This week in Resend');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/get'
    );
    await expectExit1(() =>
      getBroadcastCommand.parseAsync(['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'], {
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

    const { getBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/get'
    );
    await expectExit1(() =>
      getBroadcastCommand.parseAsync(['00000000-0000-0000-0000-00000000bad0'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
