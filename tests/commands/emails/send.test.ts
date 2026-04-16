import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  ExitError,
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

const mockBuildReactEmailHtml = vi.fn(
  async () => '<html><body>Rendered</body></html>',
);

vi.mock('../../../src/lib/react-email', () => ({
  buildReactEmailHtml: (...args: unknown[]) => mockBuildReactEmailHtml(...args),
}));

describe('send command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    vi.resetModules();
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
    mockDomainsList.mockClear();
    mockBuildReactEmailHtml.mockClear();
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

  it('sends email with all flags provided', async () => {
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

  it('dry-run does not call API and prints request summary', async () => {
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
        '--dry-run',
      ],
      { from: 'user' },
    );

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockDomainsList).not.toHaveBeenCalled();
    const out = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(out.dryRun).toBe(true);
    expect(out.request.from).toBe('a@test.com');
    expect(out.request.to).toEqual(['b@test.com']);
  });

  it('dry-run does not require API key or call domains API', async () => {
    spies = setupOutputSpies();
    delete process.env.RESEND_API_KEY;

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
        '--dry-run',
      ],
      { from: 'user' },
    );

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockDomainsList).not.toHaveBeenCalled();
    const out = JSON.parse(spies.logSpy.mock.calls[0][0] as string);
    expect(out.dryRun).toBe(true);
  });

  it('outputs JSON with email ID on success', async () => {
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

  it('sends HTML email when --html provided', async () => {
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

  it('supports multiple --to addresses', async () => {
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

  it('errors when no API key and non-interactive', async () => {
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

  it('errors listing missing flags in non-interactive mode', async () => {
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

  it('errors when no body and non-interactive', async () => {
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

  it('reads HTML body from --html-file', async () => {
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

  it('passes cc, bcc, reply-to when provided', async () => {
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

  it('does not call domains.list when --from is provided', async () => {
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

  it('passes scheduledAt to SDK when --scheduled-at provided', async () => {
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

  it('reads attachment file and passes filename and content to SDK', async () => {
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

  it('errors with file_read_error for missing attachment', async () => {
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

  it('parses key=value headers correctly', async () => {
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

  it('errors with invalid_header for malformed header', async () => {
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

  it('parses name=value tags correctly', async () => {
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

  it('errors with invalid_tag for malformed tag', async () => {
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

  it('passes idempotencyKey as second arg to emails.send', async () => {
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

  it('errors with missing_flags when --json is set and --from is missing', async () => {
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

  it('reads plain text body from --text-file', async () => {
    spies = setupOutputSpies();

    const tmpFile = join(
      dirname(fileURLToPath(import.meta.url)),
      '__test_body.txt',
    );
    writeFileSync(tmpFile, 'Plain text from file');

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
          '--text-file',
          tmpFile,
        ],
        { from: 'user' },
      );

      const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.text).toBe('Plain text from file');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('--text-file - reads from stdin', async () => {
    spies = setupOutputSpies();

    const files = await import('../../../src/lib/files');
    const readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('stdin text content');

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
          '--text-file',
          '-',
        ],
        { from: 'user' },
      );

      expect(readFileSpy).toHaveBeenCalledWith('-', expect.anything());
      const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.text).toBe('stdin text content');
    } finally {
      readFileSpy.mockRestore();
    }
  });

  it('--html-file - reads from stdin', async () => {
    spies = setupOutputSpies();

    const files = await import('../../../src/lib/files');
    const readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('<h1>stdin html</h1>');

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
          '-',
        ],
        { from: 'user' },
      );

      expect(readFileSpy).toHaveBeenCalledWith('-', expect.anything());
      const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.html).toBe('<h1>stdin html</h1>');
    } finally {
      readFileSpy.mockRestore();
    }
  });

  it('sends both html and text when both provided', async () => {
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
        '--text',
        'Hello',
      ],
      { from: 'user' },
    );

    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.html).toBe('<h1>Hello</h1>');
    expect(callArgs.text).toBe('Hello');
  });

  it('warns to stderr when --html and --html-file both provided', async () => {
    spies = setupOutputSpies();

    const tmpFile = join(
      dirname(fileURLToPath(import.meta.url)),
      '__test_html_warn.html',
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
          '--html',
          '<h1>Inline</h1>',
          '--html-file',
          tmpFile,
        ],
        { from: 'user' },
      );

      const stderrOutput = spies.stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('--html-file');
      const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.html).toBe('<h1>From file</h1>');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('warns to stderr when --text and --text-file both provided', async () => {
    spies = setupOutputSpies();

    const tmpFile = join(
      dirname(fileURLToPath(import.meta.url)),
      '__test_text_warn.txt',
    );
    writeFileSync(tmpFile, 'From file');

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
          'Inline text',
          '--text-file',
          tmpFile,
        ],
        { from: 'user' },
      );

      const stderrOutput = spies.stderrSpy.mock.calls.map((c) => c[0]).join('');
      expect(stderrOutput).toContain('--text-file');
      const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs.text).toBe('From file');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('errors when --html-file - and --text-file - both read stdin', async () => {
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
          '--html-file',
          '-',
          '--text-file',
          '-',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  it('errors with invalid_options when --subject is empty string', async () => {
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
          '',
          '--text',
          'Hi',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  it('errors with invalid_options when --from is empty string', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--from',
          '',
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

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  it('sends with --template and --to only', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      ['--template', 'tmpl_123', '--to', 'b@test.com'],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.template).toEqual({ id: 'tmpl_123' });
    expect(callArgs.to).toEqual(['b@test.com']);
    expect(callArgs.from).toBeUndefined();
    expect(callArgs.subject).toBeUndefined();
    expect(callArgs.html).toBeUndefined();
    expect(callArgs.text).toBeUndefined();
  });

  it('sends with --template and --var key=value pairs', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--template',
        'tmpl_123',
        '--to',
        'b@test.com',
        '--var',
        'name=John',
        'count=42',
      ],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.template).toEqual({
      id: 'tmpl_123',
      variables: { name: 'John', count: '42' },
    });
  });

  it('preserves leading zeros in --var values', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      ['--template', 'tmpl_123', '--to', 'b@test.com', '--var', 'otp=012345'],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.template).toEqual({
      id: 'tmpl_123',
      variables: { otp: '012345' },
    });
  });

  it('preserves large numeric strings beyond MAX_SAFE_INTEGER in --var values', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--template',
        'tmpl_123',
        '--to',
        'b@test.com',
        '--var',
        'account_id=9007199254740993',
      ],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.template).toEqual({
      id: 'tmpl_123',
      variables: { account_id: '9007199254740993' },
    });
  });

  it('preserves scientific notation strings in --var values', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      ['--template', 'tmpl_123', '--to', 'b@test.com', '--var', 'code=1e3'],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.template).toEqual({
      id: 'tmpl_123',
      variables: { code: '1e3' },
    });
  });

  it('sends with --template plus --from and --subject overrides', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--template',
        'tmpl_123',
        '--to',
        'b@test.com',
        '--from',
        'a@test.com',
        '--subject',
        'Override',
      ],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.template).toEqual({ id: 'tmpl_123' });
    expect(callArgs.from).toBe('a@test.com');
    expect(callArgs.subject).toBe('Override');
  });

  it('errors with invalid_var when --var used without --template', async () => {
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
          '--var',
          'name=John',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_var');
    expect(output).toContain('--template');
  });

  it('errors with invalid_var for malformed --var', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        ['--template', 'tmpl_123', '--to', 'b@test.com', '--var', 'no-equals'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_var');
  });

  it('errors with template_body_conflict when --template and --html used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--template',
          'tmpl_123',
          '--to',
          'b@test.com',
          '--html',
          '<h1>Hi</h1>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('template_body_conflict');
  });

  it('errors with template_body_conflict when --template and --html-file used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--template',
          'tmpl_123',
          '--to',
          'b@test.com',
          '--html-file',
          './email.html',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('template_body_conflict');
  });

  it('errors with template_body_conflict when --template and --text used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        ['--template', 'tmpl_123', '--to', 'b@test.com', '--text', 'Hi'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('template_body_conflict');
  });

  it('errors with template_body_conflict when --template and --text-file used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--template',
          'tmpl_123',
          '--to',
          'b@test.com',
          '--text-file',
          './body.txt',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('template_body_conflict');
  });

  it('errors with template_attachment_conflict when --template and --attachment used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--template',
          'tmpl_123',
          '--to',
          'b@test.com',
          '--attachment',
          'file.pdf',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('template_attachment_conflict');
  });

  it('sends email with --react-email flag', async () => {
    spies = setupOutputSpies();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await sendCommand.parseAsync(
      [
        '--from',
        'a@test.com',
        '--to',
        'b@test.com',
        '--subject',
        'Welcome',
        '--react-email',
        './emails/welcome.tsx',
      ],
      { from: 'user' },
    );

    expect(mockBuildReactEmailHtml).toHaveBeenCalledWith(
      './emails/welcome.tsx',
      expect.anything(),
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.html).toBe('<html><body>Rendered</body></html>');
  });

  it('errors with invalid_options when --react-email and --html used together', async () => {
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
          '--react-email',
          './emails/welcome.tsx',
          '--html',
          '<h1>Hi</h1>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  it('errors with invalid_options when --react-email and --html-file used together', async () => {
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
          '--react-email',
          './emails/welcome.tsx',
          '--html-file',
          './email.html',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  it('allows --react-email with --text for plain-text fallback', async () => {
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
        '--react-email',
        './emails/welcome.tsx',
        '--text',
        'Plain text fallback',
      ],
      { from: 'user' },
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.html).toBe('<html><body>Rendered</body></html>');
    expect(callArgs.text).toBe('Plain text fallback');
  });

  it('errors with invalid_options when --react-email and --template used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { sendCommand } = await import('../../../src/commands/emails/send');
    await expectExit1(() =>
      sendCommand.parseAsync(
        [
          '--to',
          'b@test.com',
          '--react-email',
          './emails/welcome.tsx',
          '--template',
          'tmpl_123',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  it('exits when buildReactEmailHtml fails', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    mockBuildReactEmailHtml.mockRejectedValueOnce(new ExitError(1));

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
          '--react-email',
          './emails/broken.tsx',
        ],
        { from: 'user' },
      ),
    );
  });

  it('degrades gracefully when domain fetch fails', async () => {
    const { fetchVerifiedDomains } = await import('../../../src/lib/domains');
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
