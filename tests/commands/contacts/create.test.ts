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
  data: { object: 'contact' as const, id: 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6' },
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
    expect(parsed.id).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
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
      ['--email', 'jane@example.com', '--segment-id', '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d'],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.segments).toEqual([{ id: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d' }]);
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
        '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
        '--segment-id',
        'e8d7c6b5-a4f3-2e1d-0c9b-8a7f6e5d4c3b',
      ],
      { from: 'user' },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.segments).toEqual([{ id: '3f2a1b4c-5d6e-7f8a-9b0c-1d2e3f4a5b6c' }, { id: 'e8d7c6b5-a4f3-2e1d-0c9b-8a7f6e5d4c3b' }]);
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
