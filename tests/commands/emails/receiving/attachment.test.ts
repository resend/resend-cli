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

const mockGet = vi.fn(async () => ({
  data: {
    object: 'attachment' as const,
    id: 'attach_abc123',
    filename: 'invoice.pdf',
    size: 51200,
    content_type: 'application/pdf',
    content_disposition: 'attachment' as const,
    content_id: undefined,
    download_url: 'https://storage.example.com/signed/invoice.pdf',
    expires_at: '2026-02-18T13:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { receiving: { attachments: { get: mockGet } } };
  },
}));

describe('emails receiving attachment command', () => {
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

  test('calls SDK get with emailId and attachmentId', async () => {
    spies = setupOutputSpies();

    const { getAttachmentCommand } = await import(
      '../../../../src/commands/emails/receiving/attachment'
    );
    await getAttachmentCommand.parseAsync(['rcv_email123', 'attach_abc123'], {
      from: 'user',
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    const args = mockGet.mock.calls[0][0] as Record<string, unknown>;
    expect(args.emailId).toBe('rcv_email123');
    expect(args.id).toBe('attach_abc123');
  });

  test('outputs JSON with attachment fields when non-interactive', async () => {
    spies = setupOutputSpies();

    const { getAttachmentCommand } = await import(
      '../../../../src/commands/emails/receiving/attachment'
    );
    await getAttachmentCommand.parseAsync(['rcv_email123', 'attach_abc123'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('attach_abc123');
    expect(parsed.filename).toBe('invoice.pdf');
    expect(parsed.content_type).toBe('application/pdf');
    expect(parsed.download_url).toBe(
      'https://storage.example.com/signed/invoice.pdf',
    );
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { getAttachmentCommand } = await import(
      '../../../../src/commands/emails/receiving/attachment'
    );
    await expectExit1(() =>
      getAttachmentCommand.parseAsync(['rcv_email123', 'attach_abc123'], {
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

    const { getAttachmentCommand } = await import(
      '../../../../src/commands/emails/receiving/attachment'
    );
    await expectExit1(() =>
      getAttachmentCommand.parseAsync(['rcv_email123', 'attach_nonexistent'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('fetch_error');
  });
});
