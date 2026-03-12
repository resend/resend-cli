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
} from '../../../helpers';

const mockList = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    has_more: false,
    data: [
      {
        id: 'attach_abc123',
        filename: 'invoice.pdf',
        size: 51200,
        content_type: 'application/pdf',
        content_disposition: 'attachment' as const,
        content_id: null,
        download_url: 'https://storage.example.com/signed/invoice.pdf',
        expires_at: '2026-02-18T13:00:00.000Z',
      },
    ],
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { receiving: { attachments: { list: mockList } } };
  },
}));

describe('emails receiving attachments command', () => {
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

  test('calls SDK list with emailId and default pagination', async () => {
    spies = setupOutputSpies();

    const { listAttachmentsCommand } = await import(
      '../../../../src/commands/emails/receiving/attachments'
    );
    await listAttachmentsCommand.parseAsync(['rcv_email123'], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.emailId).toBe('rcv_email123');
    expect(args.limit).toBe(10);
  });

  test('passes --limit to pagination options', async () => {
    spies = setupOutputSpies();

    const { listAttachmentsCommand } = await import(
      '../../../../src/commands/emails/receiving/attachments'
    );
    await listAttachmentsCommand.parseAsync(['rcv_email123', '--limit', '5'], {
      from: 'user',
    });

    const args = mockList.mock.calls[0][0] as Record<string, unknown>;
    expect(args.limit).toBe(5);
  });

  test('outputs JSON list with attachment data when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listAttachmentsCommand } = await import(
      '../../../../src/commands/emails/receiving/attachments'
    );
    await listAttachmentsCommand.parseAsync(['rcv_email123'], { from: 'user' });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(parsed.data[0].id).toBe('attach_abc123');
    expect(parsed.data[0].filename).toBe('invoice.pdf');
    expect(parsed.data[0].content_type).toBe('application/pdf');
    expect(parsed.has_more).toBe(false);
  });

  test('errors with invalid_limit for out-of-range limit', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listAttachmentsCommand } = await import(
      '../../../../src/commands/emails/receiving/attachments'
    );
    await expectExit1(() =>
      listAttachmentsCommand.parseAsync(['rcv_email123', '--limit', '200'], {
        from: 'user',
      }),
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

    const { listAttachmentsCommand } = await import(
      '../../../../src/commands/emails/receiving/attachments'
    );
    await expectExit1(() =>
      listAttachmentsCommand.parseAsync(['rcv_email123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockList.mockResolvedValueOnce(mockSdkError('Not found', 'not_found'));
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listAttachmentsCommand } = await import(
      '../../../../src/commands/emails/receiving/attachments'
    );
    await expectExit1(() =>
      listAttachmentsCommand.parseAsync(['rcv_nonexistent'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
