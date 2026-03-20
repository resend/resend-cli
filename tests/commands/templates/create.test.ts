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
  data: { object: 'template' as const, id: 'tmpl_abc123' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    templates = { create: mockCreate };
  },
}));

describe('templates create command', () => {
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

  test('creates template with required flags', async () => {
    spies = setupOutputSpies();

    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );
    await createTemplateCommand.parseAsync(
      ['--name', 'Welcome', '--html', '<h1>Hello</h1>'],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.name).toBe('Welcome');
    expect(args.html).toBe('<h1>Hello</h1>');
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );
    await createTemplateCommand.parseAsync(
      ['--name', 'Welcome', '--html', '<h1>Hello</h1>'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('tmpl_abc123');
  });

  test('errors with missing_name when --name absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );
    await expectExit1(() =>
      createTemplateCommand.parseAsync(['--html', '<h1>Hello</h1>'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  test('errors with missing_body when no body flag in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );
    await expectExit1(() =>
      createTemplateCommand.parseAsync(['--name', 'Welcome'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_body');
  });

  test('errors with missing_name when --json is set even in TTY', async () => {
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
    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(createTemplateCommand);
    commandRef = createTemplateCommand as unknown as { parent: unknown };

    await expectExit1(() =>
      program.parseAsync(['create', '--json', '--html', '<h1>Hello</h1>'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  test('reads text body from --text-file and passes it to SDK', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValueOnce('<h1>HTML</h1>')
      .mockReturnValueOnce('Plain text from file');

    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );

    await createTemplateCommand.parseAsync(
      [
        '--name',
        'Welcome',
        '--html-file',
        '/fake/email.html',
        '--text-file',
        '/fake/body.txt',
      ],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledTimes(2);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.html).toBe('<h1>HTML</h1>');
    expect(args.text).toBe('Plain text from file');
  });

  test('warns to stderr when --text and --text-file both provided, text-file wins', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi.spyOn(files, 'readFile').mockReturnValue('From file');

    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );
    await createTemplateCommand.parseAsync(
      [
        '--name',
        'Welcome',
        '--html',
        '<h1>Hello</h1>',
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

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );
    await expectExit1(() =>
      createTemplateCommand.parseAsync(
        ['--name', 'Welcome', '--html', '<h1>Hello</h1>'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Template name taken', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createTemplateCommand } = await import(
      '../../../src/commands/templates/create'
    );
    await expectExit1(() =>
      createTemplateCommand.parseAsync(
        ['--name', 'Welcome', '--html', '<h1>Hello</h1>'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
