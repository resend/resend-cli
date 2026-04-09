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

const mockListSegments = vi.fn(async () => ({
  data: {
    object: 'list' as const,
    data: [
      {
        id: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        name: 'Newsletter',
        created_at: '2026-01-01T00:00:00.000Z',
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
      segments: { list: mockListSegments },
    };
  },
}));

describe('contacts segments command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockListSegments.mockClear();
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

  test('lists segments by contact ID', async () => {
    spies = setupOutputSpies();

    const { listContactSegmentsCommand } = await import(
      '../../../src/commands/contacts/segments'
    );
    await listContactSegmentsCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      {
        from: 'user',
      },
    );

    expect(mockListSegments).toHaveBeenCalledTimes(1);
    const args = mockListSegments.mock.calls[0][0] as Record<string, unknown>;
    expect(args.contactId).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(args.email).toBeUndefined();
  });

  test('lists segments by contact email', async () => {
    spies = setupOutputSpies();

    const { listContactSegmentsCommand } = await import(
      '../../../src/commands/contacts/segments'
    );
    await listContactSegmentsCommand.parseAsync(['jane@example.com'], {
      from: 'user',
    });

    const args = mockListSegments.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
    expect(args.contactId).toBeUndefined();
  });

  test('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listContactSegmentsCommand } = await import(
      '../../../src/commands/contacts/segments'
    );
    await listContactSegmentsCommand.parseAsync(
      ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      {
        from: 'user',
      },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data[0].name).toBe('Newsletter');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { listContactSegmentsCommand } = await import(
      '../../../src/commands/contacts/segments'
    );
    await expectExit1(() =>
      listContactSegmentsCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with list_error when SDK returns an error', async () => {
    setNonInteractive();
    mockListSegments.mockResolvedValueOnce(
      mockSdkError('Not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { listContactSegmentsCommand } = await import(
      '../../../src/commands/contacts/segments'
    );
    await expectExit1(() =>
      listContactSegmentsCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('list_error');
  });
});
