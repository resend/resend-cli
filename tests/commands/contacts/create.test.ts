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

const mockCreate = mock(async () => ({
  data: { object: 'contact' as const, id: 'contact_abc123' },
  error: null,
}));

mock.module('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = { create: mockCreate };
  },
}));

describe('contacts create command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
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

  test('creates contact with --email flag', async () => {
    spies = setupOutputSpies();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await createContactCommand.parseAsync(['--email', 'jane@example.com'], {
      from: 'user',
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
  });

  test('outputs JSON id when non-interactive', async () => {
    spies = setupOutputSpies();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await createContactCommand.parseAsync(['--email', 'jane@example.com'], {
      from: 'user',
    });

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('contact_abc123');
    expect(parsed.object).toBe('contact');
  });

  test('passes --first-name and --last-name to SDK', async () => {
    spies = setupOutputSpies();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await createContactCommand.parseAsync(
      [
        '--email',
        'jane@example.com',
        '--first-name',
        'Jane',
        '--last-name',
        'Smith',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.firstName).toBe('Jane');
    expect(args.lastName).toBe('Smith');
  });

  test('passes --unsubscribed flag to SDK', async () => {
    spies = setupOutputSpies();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await createContactCommand.parseAsync(
      ['--email', 'jane@example.com', '--unsubscribed'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.unsubscribed).toBe(true);
  });

  test('parses --properties JSON and passes to SDK', async () => {
    spies = setupOutputSpies();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await createContactCommand.parseAsync(
      [
        '--email',
        'jane@example.com',
        '--properties',
        '{"company":"Acme","plan":"pro"}',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.properties).toEqual({ company: 'Acme', plan: 'pro' });
  });

  test('passes --segment-id (single) to SDK as segments array', async () => {
    spies = setupOutputSpies();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await createContactCommand.parseAsync(
      ['--email', 'jane@example.com', '--segment-id', 'seg_123'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.segments).toEqual([{ id: 'seg_123' }]);
  });

  test('passes multiple --segment-id values to SDK', async () => {
    spies = setupOutputSpies();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await createContactCommand.parseAsync(
      [
        '--email',
        'jane@example.com',
        '--segment-id',
        'seg_abc',
        '--segment-id',
        'seg_def',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.segments).toEqual([{ id: 'seg_abc' }, { id: 'seg_def' }]);
  });

  test('errors with missing_email in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await expectExit1(() =>
      createContactCommand.parseAsync([], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_email');
  });

  test('errors with invalid_properties when --properties is not valid JSON', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await expectExit1(() =>
      createContactCommand.parseAsync(
        ['--email', 'jane@example.com', '--properties', 'not-json'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_properties');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await expectExit1(() =>
      createContactCommand.parseAsync(['--email', 'jane@example.com'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Contact already exists', 'validation_error'),
    );
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { createContactCommand } = await import(
      '../../../src/commands/contacts/create'
    );
    await expectExit1(() =>
      createContactCommand.parseAsync(['--email', 'jane@example.com'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
