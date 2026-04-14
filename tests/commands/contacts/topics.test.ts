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

const mockListTopics = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    data: [
      {
        id: 'topic_abc',
        name: 'Product Updates',
        description: 'Updates about the product',
        subscription: 'opt_in' as const,
      },
    ],
    has_more: false,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      topics: { list: mockListTopics },
    };
  },
}));

describe('contacts topics command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockListTopics.mockClear();
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

  test('lists topics by contact ID', async () => {
    spies = setupOutputSpies();

    const { listContactTopicsCommand } = await import(
      '../../../src/commands/contacts/topics'
    );
    await listContactTopicsCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      {
        from: 'user',
      },
    );

    expect(mockListTopics).toHaveBeenCalledTimes(1);
    const args = mockListTopics.mock.calls[0][0] as Record<string, unknown>;
    expect(args.id).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
  });

  test('lists topics by contact email', async () => {
    spies = setupOutputSpies();

    const { listContactTopicsCommand } = await import(
      '../../../src/commands/contacts/topics'
    );
    await listContactTopicsCommand.parseAsync(['jane@example.com'], {
      from: 'user',
    });

    const args = mockListTopics.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
  });

  test('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listContactTopicsCommand } = await import(
      '../../../src/commands/contacts/topics'
    );
    await listContactTopicsCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      {
        from: 'user',
      },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].name).toBe('Product Updates');
    expect(parsed.data[0].subscription).toBe('opt_in');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listContactTopicsCommand } = await import(
      '../../../src/commands/contacts/topics'
    );
    await expectExit1(() =>
      listContactTopicsCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockListTopics.mockResolvedValueOnce(
      mockSdkError('Not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listContactTopicsCommand } = await import(
      '../../../src/commands/contacts/topics'
    );
    await expectExit1(() =>
      listContactTopicsCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
