import { Command } from '@commander-js/extra-typings';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { updateSegmentCommand } from '../../../src/commands/segments/update';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockUpdate = vi.fn(async () => ({
  data: {
    object: 'segment' as const,
    id: '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    segments = { update: mockUpdate };
  },
}));

describe('segments update command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let commandRef: { parent: unknown } | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
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
    if (commandRef) {
      commandRef.parent = null;
      commandRef = undefined;
    }
  });

  it('updates segment with id and --name flag', async () => {
    spies = setupOutputSpies();

    await updateSegmentCommand.parseAsync(
      ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', '--name', 'Active Subscribers'],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0]).toBe(
      '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
    );
    const payload = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.name).toBe('Active Subscribers');
  });

  it('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    await updateSegmentCommand.parseAsync(
      ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', '--name', 'Active Subscribers'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('segment');
    expect(parsed.id).toBe('3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c');
  });

  it('errors with missing_name when --name absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateSegmentCommand.parseAsync(
        ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  it('errors with missing_name when --json is set even in TTY', async () => {
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

    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(updateSegmentCommand);
    commandRef = updateSegmentCommand as unknown as { parent: unknown };

    await expectExit1(() =>
      program.parseAsync(
        ['update', '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c', '--json'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
  });

  it('does not call SDK when missing_name error is raised', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateSegmentCommand.parseAsync(
        ['3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c'],
        { from: 'user' },
      ),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateSegmentCommand.parseAsync(
        [
          '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
          '--name',
          'Active Subscribers',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  it('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Segment not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateSegmentCommand.parseAsync(
        [
          '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
          '--name',
          'Active Subscribers',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
