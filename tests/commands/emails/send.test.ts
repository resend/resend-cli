import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockSend = vi.fn(async () => ({
  data: { id: 'test-email-id-123' },
  error: null,
}));

const mockDomainsList = vi.fn(async () => ({
  data: { data: [] },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { send: mockSend };
    domains = { list: mockDomainsList };
  },
}));

describe('send command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
    mockDomainsList.mockClear();
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

  test('sends email with all flags provided', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--text',
        'Hello',
      ],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.from).toBe('a@test.com');
    expect(callArgs.to).toEqual(['b@test.com']);
    expect(callArgs.subject).toBe('Test');
    expect(callArgs.text).toBe('Hello');
  });

  test('outputs JSON with email ID on success', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--text',
        'Body',
      ],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('test-email-id-123');
  });

  test('sends HTML email when --html provided', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--html',
        '<h1>Hello</h1>',
      ],
      { from: 'user' },
    );

    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.html).toBe('<h1>Hello</h1>');
    expect(callArgs.text).toBeUndefined();
  });

  test('supports multiple --to addresses', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        'c@test.com',
        '--subject',
        'Test',
        '--text',
        'Hi',
      ],
      { from: 'user' },
    );

    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.to).toEqual(['b@test.com', 'c@test.com']);
  });

  test('errors when no API key and non-interactive', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = join(
      tmpdir(),
      `resend-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--from',
          'a@test.com',
          '--to',
          'b@test.com',
          '--subject',
          'Test',
          '--text',
          'Hi',
        ],
        { from: 'user' },
      ),
    );
  });

  test('errors listing missing flags in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(['--from', 'a@test.com'], { from: 'user' }),
    );

    const allErrors = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(allErrors).toContain('--to');
    expect(allErrors).toContain('--subject');
  });

  test('errors when no body and non-interactive', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        ['--from', 'a@test.com', '--to', 'b@test.com', '--subject', 'Test'],
        { from: 'user' },
      ),
    );
  });

  test('reads HTML body from --html-file', async () => {
    spies = setupOutputSpies();

    const tmpFile = join(
      dirname(fileURLToPath(import.meta.url)),
      '__test_email.html',
    );
    writeFileSync(tmpFile, '<h1>From file</h1>');

    try {
      const { sendCommand } = await import('../../../src/commands/emails/send');
      await sendCommand.parseAsync(
        [
          '--from',
          'a@test.com',
          '--to',
          'b@test.com',
          '--subject',
          'Test',
          '--html-file',
          tmpFile,
        ],
        { from: 'user' },
      );

      const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.html).toBe('<h1>From file</h1>');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  test('passes cc, bcc, reply-to when provided', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--text',
        'Body',
        '--cc',
        'cc@test.com',
        '--bcc',
        'bcc@test.com',
        '--reply-to',
        'reply@test.com',
      ],
      { from: 'user' },
    );

    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.cc).toEqual(['cc@test.com']);
    expect(callArgs.bcc).toEqual(['bcc@test.com']);
    expect(callArgs.replyTo).toBe('reply@test.com');
  });

  test('does not call domains.list when --from is provided', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--text',
        'Hello',
      ],
      { from: 'user' },
    );

    expect(mockDomainsList).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  test('passes scheduledAt to SDK when --scheduled-at provided', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--text',
        'Hi',
        '--scheduled-at',
        '2024-08-05T11:52:01.858Z',
      ],
      { from: 'user' },
    );

    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.scheduledAt).toBe('2024-08-05T11:52:01.858Z');
  });

  test('reads attachment file and passes filename and content to SDK', async () => {
    spies = setupOutputSpies();

    const tmpFile = join(
      dirname(fileURLToPath(import.meta.url)),
      '__test_attachment.txt',
    );
    writeFileSync(tmpFile, 'attachment content');

    try {
      const { sendCommand } = await import('../../../src/commands/emails/send');
      await sendCommand.parseAsync(
        [
          '--from',
          'a@test.com',
          '--to',
          'b@test.com',
          '--subject',
          'Test',
          '--text',
          'Hi',
          '--attachment',
          tmpFile,
        ],
        { from: 'user' },
      );

      const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
      const attachments = callArgs.attachments as Array<{
        filename: string;
        content: Buffer;
      }>;
      expect(attachments).toHaveLength(1);
      expect(attachments[0].filename).toBe('__test_attachment.txt');
      expect(Buffer.isBuffer(attachments[0].content)).toBe(true);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  test('errors with file_read_error for missing attachment', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--from',
          'a@test.com',
          '--to',
          'b@test.com',
          '--subject',
          'Test',
          '--text',
          'Hi',
          '--attachment',
          '/tmp/nonexistent-resend-attachment.txt',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
  });

  test('parses key=value headers correctly', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--text',
        'Hi',
        '--headers',
        'X-Entity-Ref-ID=123',
        'X-Custom=value=with=equals',
      ],
      { from: 'user' },
    );

    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.headers).toEqual({
      'X-Entity-Ref-ID': '123',
      'X-Custom': 'value=with=equals',
    });
  });

  test('errors with invalid_header for malformed header', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--from',
          'a@test.com',
          '--to',
          'b@test.com',
          '--subject',
          'Test',
          '--text',
          'Hi',
          '--headers',
          'no-equals-sign',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_header');
  });

  test('parses name=value tags correctly', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--text',
        'Hi',
        '--tags',
        'category=marketing',
        'source=campaign',
      ],
      { from: 'user' },
    );

    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.tags).toEqual([
      { name: 'category', value: 'marketing' },
      { name: 'source', value: 'campaign' },
    ]);
  });

  test('errors with invalid_tag for malformed tag', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--from',
          'a@test.com',
          '--to',
          'b@test.com',
          '--subject',
          'Test',
          '--text',
          'Hi',
          '--tags',
          'no-equals-sign',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_tag');
  });

  test('passes idempotencyKey as second arg to emails.send', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Test',
        '--text',
        'Hi',
        '--idempotency-key',
        'my-key-123',
      ],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const opts = mockSend.mock.calls[0][1] as Record<string, unknown>;
    expect(opts?.idempotencyKey).toBe('my-key-123');
  });

  test('errors with missing_flags when --json is set and --from is missing', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { Command } = await import('@commander-js/extra-typings');
    const { sendCommand } = await import('../../../src/commands/emails/send');
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(sendCommand);

    await expectExit1(() =>
      program.parseAsync(
        [
          'send',
          '--json',
          '--to',
          'b@test.com',
          '--subject',
          'Test',
          '--text',
          'Hi',
        ],
        { from: 'user' },
      ),
    );

    // domain list should NOT be called since --json suppresses interactive prompts
    expect(mockDomainsList).not.toHaveBeenCalled();

    // @ts-expect-error — reset parent to avoid polluting the shared singleton
    sendCommand.parent = null;
  });

  test('degrades gracefully when domain fetch fails', async () => {
    const { fetchVerifiedDomains } = await import(
      '../../../src/commands/emails/send'
    );
    const failingResend = {
      domains: {
        list: vi.fn(async () => {
          throw new Error('Network error');
        }),
      },
    } as Record<string, unknown>;

    // Should return [] without throwing, so the caller falls through to promptForMissing
    const result = await fetchVerifiedDomains(failingResend);
    expect(result).toEqual([]);
  });
});
