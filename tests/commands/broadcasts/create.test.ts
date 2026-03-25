import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import * as files from '../../../src/lib/files';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockCreate = vi.fn(async () => ({
  data: { id: 'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { create: mockCreate };
  },
}));

const mockBuildReactEmailHtml = vi.fn(
  async () => '<html><body>Rendered</body></html>',
);

vi.mock('../../../src/lib/react-email', () => ({
  buildReactEmailHtml: (...args: unknown[]) => mockBuildReactEmailHtml(...args),
}));

describe('broadcasts create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let readFileSpy: MockInstance | undefined;
  let commandRef: { parent: unknown } | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
    mockBuildReactEmailHtml.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    stderrSpy?.mockRestore();
    exitSpy?.mockRestore();
    readFileSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    stderrSpy = undefined;
    exitSpy = undefined;
    readFileSpy = undefined;
    if (commandRef) {
      commandRef.parent = null;
      commandRef = undefined;
    }
  });

  test('creates broadcast with required flags', async () => {
    spies = setupOutputSpies();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'Weekly Update',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--html',
        '<p>Hi</p>',
      ],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.from).toBe('hello@domain.com');
    expect(args.subject).toBe('Weekly Update');
    expect(args.segmentId).toBe('7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d');
    expect(args.html).toBe('<p>Hi</p>');
  });

  test('outputs JSON id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'News',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--text',
        'Hello!',
      ],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
  });

  test('passes --send flag to SDK', async () => {
    spies = setupOutputSpies();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'Go',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--text',
        'Hi',
        '--send',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.send).toBe(true);
  });

  test('passes --scheduled-at with --send to SDK', async () => {
    spies = setupOutputSpies();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'Go',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--text',
        'Hi',
        '--send',
        '--scheduled-at',
        'in 1 hour',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.scheduledAt).toBe('in 1 hour');
  });

  test('passes optional flags to SDK', async () => {
    spies = setupOutputSpies();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'News',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--html',
        '<p>Hi</p>',
        '--name',
        'Q1 Newsletter',
        '--reply-to',
        'reply@domain.com',
        '--preview-text',
        'Read the news',
        '--topic-id',
        'topic_xyz',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.name).toBe('Q1 Newsletter');
    expect(args.replyTo).toBe('reply@domain.com');
    expect(args.previewText).toBe('Read the news');
    expect(args.topicId).toBe('topic_xyz');
  });

  test('errors with missing_from when --from absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--subject',
          'News',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
          '--html',
          '<p>Hi</p>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_from');
  });

  test('errors with missing_subject when --subject absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--from',
          'hello@domain.com',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
          '--html',
          '<p>Hi</p>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_subject');
  });

  test('errors with missing_segment when --segment-id absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--from',
          'hello@domain.com',
          '--subject',
          'News',
          '--html',
          '<p>Hi</p>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_segment');
  });

  test('errors with missing_body when no body flag in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--from',
          'hello@domain.com',
          '--subject',
          'News',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_body');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--from',
          'hello@domain.com',
          '--subject',
          'News',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
          '--html',
          '<p>Hi</p>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Segment not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--from',
          'hello@domain.com',
          '--subject',
          'News',
          '--segment-id',
          '00000000-0000-0000-0000-000000000bad',
          '--html',
          '<p>Hi</p>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });

  test('does not call SDK when validation fails', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync([], { from: 'user' }),
    );

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('errors with missing_from when --json is set even in TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: true,
      writable: true,
    });
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      writable: true,
    });
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { Command } = await import('@commander-js/extra-typings');
    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(createBroadcastCommand);
    commandRef = createBroadcastCommand as unknown as { parent: unknown };

    await expectExit1(() =>
      program.parseAsync(
        [
          'create',
          '--json',
          '--subject',
          'News',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
          '--html',
          '<p>Hi</p>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_from');
  });

  test('reads html body from --html-file and passes it to SDK', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('<p>From file</p>');

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'News',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--html-file',
        '/fake/email.html',
      ],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.html).toBe('<p>From file</p>');
  });

  test('reads text body from --text-file and passes it to SDK', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('Plain text from file');

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'News',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--text-file',
        '/fake/body.txt',
      ],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.text).toBe('Plain text from file');
  });

  test('warns to stderr when --html and --html-file both provided, html-file wins', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('<p>From file</p>');

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'News',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--html',
        '<p>Inline</p>',
        '--html-file',
        '/fake/email.html',
      ],
      { from: 'user' },
    );

    const stderrOutput = spies.stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(stderrOutput).toContain('--html-file');
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.html).toBe('<p>From file</p>');
  });

  test('warns to stderr when --text and --text-file both provided, text-file wins', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi.spyOn(files, 'readFile').mockReturnValue('From file');

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'News',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--text',
        'Inline text',
        '--text-file',
        '/fake/body.txt',
      ],
      { from: 'user' },
    );

    const stderrOutput = spies.stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(stderrOutput).toContain('--text-file');
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.text).toBe('From file');
  });

  test('errors with invalid_options when --html-file - and --text-file - both read stdin', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--from',
          'hello@domain.com',
          '--subject',
          'News',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
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

  test('--text-file - passes stdin to readFile', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('stdin text content');

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'News',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--text-file',
        '-',
      ],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledWith('-', expect.anything());
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.text).toBe('stdin text content');
  });

  test('creates broadcast with --react-email flag', async () => {
    spies = setupOutputSpies();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await createBroadcastCommand.parseAsync(
      [
        '--from',
        'hello@domain.com',
        '--subject',
        'Weekly Update',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        '--react-email',
        './emails/newsletter.tsx',
      ],
      { from: 'user' },
    );

    expect(mockBuildReactEmailHtml).toHaveBeenCalledWith(
      './emails/newsletter.tsx',
      expect.anything(),
    );
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.html).toBe('<html><body>Rendered</body></html>');
  });

  test('errors with invalid_options when --react-email and --html used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--from',
          'hello@domain.com',
          '--subject',
          'News',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
          '--react-email',
          './emails/newsletter.tsx',
          '--html',
          '<p>Hi</p>',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
  });

  test('errors with file_read_error when --html-file path is unreadable', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { outputError } = await import('../../../src/lib/output');
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockImplementation(
        (filePath: string, globalOpts: { json?: boolean }) => {
          outputError(
            {
              message: `Failed to read file: ${filePath}`,
              code: 'file_read_error',
            },
            { json: globalOpts.json },
          );
        },
      );

    const { createBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/create'
    );
    await expectExit1(() =>
      createBroadcastCommand.parseAsync(
        [
          '--from',
          'hello@domain.com',
          '--subject',
          'News',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
          '--html-file',
          '/nonexistent/file.html',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
  });
});
