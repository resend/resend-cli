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
} from '../../helpers';

const mockUpdateTopics = vi.fn(async () => ({
  data: { id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      topics: { update: mockUpdateTopics },
    };
  },
}));

describe('contacts update-topics command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let commandRef: { parent: unknown } | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdateTopics.mockClear();
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

  test('updates topics by contact ID', async () => {
    spies = setupOutputSpies();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await updateContactTopicsCommand.parseAsync(
      [
        'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--topics',
        '[{"id":"topic_abc","subscription":"opt_in"}]',
      ],
      { from: 'user' },
    );

    expect(mockUpdateTopics).toHaveBeenCalledTimes(1);
    const args = mockUpdateTopics.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(args.topics).toEqual([{ id: 'topic_abc', subscription: 'opt_in' }]);
  });

  test('updates topics by contact email', async () => {
    spies = setupOutputSpies();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await updateContactTopicsCommand.parseAsync(
      [
        'jane@example.com',
        '--topics',
        '[{"id":"topic_abc","subscription":"opt_out"}]',
      ],
      { from: 'user' },
    );

    const args = mockUpdateTopics.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
    expect(args.topics[0].subscription).toBe('opt_out');
  });

  test('passes multiple topics in array', async () => {
    spies = setupOutputSpies();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await updateContactTopicsCommand.parseAsync(
      [
        'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--topics',
        '[{"id":"t1","subscription":"opt_in"},{"id":"t2","subscription":"opt_out"}]',
      ],
      { from: 'user' },
    );

    const args = mockUpdateTopics.mock.calls[0][0] as Record<string, unknown>;
    expect(args.topics).toHaveLength(2);
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await updateContactTopicsCommand.parseAsync(
      [
        'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--topics',
        '[{"id":"topic_abc","subscription":"opt_in"}]',
      ],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
  });

  test('errors with missing_topics when --topics absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_topics');
  });

  test('errors with missing_topics when --json is set even in TTY', async () => {
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
    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(updateContactTopicsCommand);
    commandRef = updateContactTopicsCommand as unknown as { parent: unknown };

    await expectExit1(() =>
      program.parseAsync(
        ['update-topics', '--json', 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_topics');
  });

  test('errors with invalid_topics when --topics is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--topics', 'not-json'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_topics');
  });

  test('errors with invalid_topics when --topics is not an array', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6', '--topics', '{"id":"t1"}'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_topics');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        [
          'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
          '--topics',
          '[{"id":"t1","subscription":"opt_in"}]',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with update_topics_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdateTopics.mockResolvedValueOnce(
      mockSdkError('Topic not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        [
          'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
          '--topics',
          '[{"id":"bad_topic","subscription":"opt_in"}]',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_topics_error');
  });
});
