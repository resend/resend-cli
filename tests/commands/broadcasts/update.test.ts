import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import * as files from '../../../src/lib/files';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockUpdate = mock(async () => ({
  data: { id: 'bcast_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    broadcasts = { update: mockUpdate };
  },
}));

describe('broadcasts update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;
  let readFileSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    spies?.restore();
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
      ['bcast_abc123', '--subject', 'Updated Subject'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toBe('bcast_abc123');
    const payload = mockUpdate.mock.calls[0][1] as any;
    expect(payload.subject).toBe('Updated Subject');
  });

  test('passes all update flags to SDK', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      [
        'bcast_abc123',
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

    const payload = mockUpdate.mock.calls[0][1] as any;
    expect(payload.from).toBe('new@domain.com');
    expect(payload.subject).toBe('New Subject');
    expect(payload.text).toBe('New body');
    expect(payload.name).toBe('New Label');
  });

  test('outputs JSON id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['bcast_abc123', '--subject', 'Updated'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('bcast_abc123');
  });

  test('omits undefined fields from SDK payload', async () => {
    spies = setupOutputSpies();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['bcast_abc123', '--name', 'Only Name'],
      { from: 'user' },
    );

    const payload = mockUpdate.mock.calls[0][1] as any;
    expect(payload.name).toBe('Only Name');
    expect(payload.from).toBeUndefined();
    expect(payload.subject).toBeUndefined();
  });

  test('errors with no_changes when no flags are provided', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
  });

  test('does not call SDK when no_changes error is raised', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(['bcast_abc123'], { from: 'user' }),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(['bcast_abc123', '--subject', 'X'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Cannot update sent broadcast',
        name: 'validation_error',
      },
    } as any);
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await expectExit1(() =>
      updateBroadcastCommand.parseAsync(['bcast_sent', '--subject', 'New'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });

  test('reads html body from --html-file and passes it to SDK', async () => {
    spies = setupOutputSpies();
    readFileSpy = spyOn(files, 'readFile').mockReturnValue(
      '<p>Updated from file</p>',
    );

    const { updateBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/update'
    );
    await updateBroadcastCommand.parseAsync(
      ['bcast_abc123', '--html-file', '/fake/email.html'],
      { from: 'user' },
    );

    expect(readFileSpy).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][1] as any;
    expect(payload.html).toBe('<p>Updated from file</p>');
  });

  test('errors with file_read_error when --html-file path is unreadable', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { outputError } = await import('../../../src/lib/output');
    readFileSpy = spyOn(files, 'readFile').mockImplementation(
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
        ['bcast_abc123', '--html-file', '/nonexistent/file.html'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('file_read_error');
  });
});
