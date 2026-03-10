import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const mockUpdateTopics = mock(async () => ({
  data: { id: 'contact_abc123' },
  error: null,
}));

mock.module('resend', () => ({
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
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdateTopics.mockClear();
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

  test('updates topics by contact ID', async () => {
    spies = setupOutputSpies();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await updateContactTopicsCommand.parseAsync(
      [
        'contact_abc123',
        '--topics',
        '[{"id":"topic_abc","subscription":"opt_in"}]',
      ],
      { from: 'user' },
    );

    expect(mockUpdateTopics).toHaveBeenCalledTimes(1);
    const args = mockUpdateTopics.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('contact_abc123');
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
        'contact_abc123',
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
        'contact_abc123',
        '--topics',
        '[{"id":"topic_abc","subscription":"opt_in"}]',
      ],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('contact_abc123');
  });

  test('errors with missing_topics when --topics absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(['contact_abc123'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_topics');
  });

  test('errors with invalid_topics when --topics is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        ['contact_abc123', '--topics', 'not-json'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_topics');
  });

  test('errors with invalid_topics when --topics is not an array', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        ['contact_abc123', '--topics', '{"id":"t1"}'],
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
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        ['contact_abc123', '--topics', '[{"id":"t1","subscription":"opt_in"}]'],
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
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { updateContactTopicsCommand } = await import(
      '../../../src/commands/contacts/update-topics'
    );
    await expectExit1(() =>
      updateContactTopicsCommand.parseAsync(
        [
          'contact_abc123',
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
