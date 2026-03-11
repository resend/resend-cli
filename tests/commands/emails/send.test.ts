import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockSend = mock(async () => ({
  data: { id: 'test-email-id-123' },
  error: null,
}));

const mockDomainsList = mock(async () => ({
  data: { data: [] },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    emails = { send: mockSend };
    domains = { list: mockDomainsList };
  },
}));

describe('send command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockClear();
    mockDomainsList.mockClear();
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
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
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
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
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
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
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

    const tmpFile = join(import.meta.dir, '__test_email.html');
    await Bun.write(tmpFile, '<h1>From file</h1>');

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

  test('degrades gracefully when domain fetch fails', async () => {
    const { fetchVerifiedDomains } = await import(
      '../../../src/commands/emails/send'
    );
    const failingResend = {
      domains: {
        list: mock(async () => {
          throw new Error('Network error');
        }),
      },
    } as Record<string, unknown>;

    // Should return [] without throwing, so the caller falls through to promptForMissing
    const result = await fetchVerifiedDomains(failingResend);
    expect(result).toEqual([]);
  });
});
