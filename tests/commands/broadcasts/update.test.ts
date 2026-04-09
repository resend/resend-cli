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

const mockUpdate = vi.fn(async () => ({
  data: { id: 'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { update: mockUpdate };
  },
}));

const mockBuildReactEmailHtml = vi.fn(
  async () => '<html><body>Rendered</body></html>',
);

vi.mock('../../../src/lib/react-email', () => ({
  buildReactEmailHtml: (...args: unknown[]) => mockBuildReactEmailHtml(...args),
}));

describe('broadcasts update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let readFileSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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
  });

  test('updates broadcast subject', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--subject', 'Updated Subject'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toBe(
      'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
    );
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.subject).toBe('Updated Subject');
  });

  test('passes all update flags to SDK', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      [
        'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--from',
        'new@domain.com',
        '--subject',
        'New Subject',
        '--text',
        'New body',
        '--name',
        'New Label',
      ],
      { from: 'user' },
    );

    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.from).toBe('new@domain.com');
    expect(payload.subject).toBe('New Subject');
    expect(payload.text).toBe('New body');
    expect(payload.name).toBe('New Label');
  });

  test('passes explicit empty text to the SDK', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--text', ''],
      { from: 'user' },
    );

    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.text).toBe('');
  });

  test('passes explicit empty html to the SDK', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--html', ''],
      { from: 'user' },
    );

    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.html).toBe('');
  });

  test('outputs JSON id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--subject', 'Updated'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
  });

  test('omits undefined fields from SDK payload', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--name', 'Only Name'],
      { from: 'user' },
    );

    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.name).toBe('Only Name');
    expect(payload.from).toBeUndefined();
    expect(payload.subject).toBeUndefined();
  });

  test('errors with no_changes when no flags are provided', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
  });

  test('does not call SDK when no_changes error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(
        ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--subject', 'X'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Cannot update sent broadcast', 'validation_error'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(
        ['s1e2n3t4-5a6b-7c8d-9e0f-a1b2c3d4e5f6', '--subject', 'New'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });

  test('reads html body from --html-file and passes it to SDK', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('<p>Updated from file</p>');

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      [
        'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--html-file',
        '/fake/email.html',
      ],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.html).toBe('<p>Updated from file</p>');
  });

  test('treats empty --html-file as a provided file input', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('<p>From empty path</p>');

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--html-file', ''],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledWith('', expect.anything());
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.html).toBe('<p>From empty path</p>');
  });

  test('reads text body from --text-file and passes it to SDK', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('Updated text from file');

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--text-file', '/fake/body.txt'],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.text).toBe('Updated text from file');
  });

  test('treats empty --text-file as a provided file input', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('Text from empty path');

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--text-file', ''],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledWith('', expect.anything());
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.text).toBe('Text from empty path');
  });

  test('warns to stderr when --html and --html-file both provided, html-file wins', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi
      .spyOn(files, 'readFile')
      .mockReturnValue('<p>From file</p>');

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      [
        'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--html',
        '<p>Inline</p>',
        '--html-file',
        '/fake/email.html',
      ],
      { from: 'user' },
    );

    const stderrOutput = spies.stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(stderrOutput).toContain('--html-file');
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.html).toBe('<p>From file</p>');
  });

  test('warns to stderr when --text and --text-file both provided, text-file wins', async () => {
    spies = setupOutputSpies();
    readFileSpy = vi.spyOn(files, 'readFile').mockReturnValue('From file');

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      [
        'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--text',
        'Inline text',
        '--text-file',
        '/fake/body.txt',
      ],
      { from: 'user' },
    );

    const stderrOutput = spies.stderrSpy.mock.calls.map((c) => c[0]).join('');
    expect(stderrOutput).toContain('--text-file');
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.text).toBe('From file');
  });

  test('errors with invalid_options when --html-file - and --text-file - both read stdin', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(
        [
          'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
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

  test('updates broadcast html with --react-email flag', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      [
        'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--react-email',
        './emails/newsletter.tsx',
      ],
      { from: 'user' },
    );

    expect(mockBuildReactEmailHtml).toHaveBeenCalledWith(
      './emails/newsletter.tsx',
      expect.anything(),
    );
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.html).toBe('<html><body>Rendered</body></html>');
  });

  test('treats empty --react-email as a provided build input', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--react-email', ''],
      { from: 'user' },
    );

    expect(mockBuildReactEmailHtml).toHaveBeenCalledWith('', expect.anything());
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.html).toBe('<html><body>Rendered</body></html>');
  });

  test('errors with invalid_options when --react-email and --html used together', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(
        [
          'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
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
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(
        [
          'd1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
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
