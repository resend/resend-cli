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

const mockAddSegment = vi.fn(async () => ({
  data: { id: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d' },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      segments: { add: mockAddSegment },
    };
  },
}));

describe('contacts add-segment command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let commandRef: { parent: unknown } | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockAddSegment.mockClear();
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

  test('adds contact to segment by contact ID', async () => {
    spies = setupOutputSpies();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await addContactSegmentCommand.parseAsync(
      [
        'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
      ],
      { from: 'user' },
    );

    expect(mockAddSegment).toHaveBeenCalledTimes(1);
    const args = mockAddSegment.mock.calls[0][0] as Record<string, unknown>;
    expect(args.contactId).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(args.segmentId).toBe('7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d');
  });

  test('adds contact to segment by email', async () => {
    spies = setupOutputSpies();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await addContactSegmentCommand.parseAsync(
      [
        'jane@example.com',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
      ],
      { from: 'user' },
    );

    const args = mockAddSegment.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
    expect(args.segmentId).toBe('7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d');
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await addContactSegmentCommand.parseAsync(
      [
        'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '--segment-id',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
      ],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d');
  });

  test('errors with missing_id when --segment-id absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await expectExit1(() =>
      addContactSegmentCommand.parseAsync(
        ['a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
  });

  test('errors with missing_id when --json is set even in TTY', async () => {
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
    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    const program = new Command()
      .option('--profile <name>')
      .option('--team <name>')
      .option('--json')
      .option('--api-key <key>')
      .option('-q, --quiet')
      .addCommand(addContactSegmentCommand);
    commandRef = addContactSegmentCommand as unknown as { parent: unknown };

    await expectExit1(() =>
      program.parseAsync(
        ['add-segment', '--json', 'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_id');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await expectExit1(() =>
      addContactSegmentCommand.parseAsync(
        [
          'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
          '--segment-id',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with add_segment_error when SDK returns an error', async () => {
    setNonInteractive();
    mockAddSegment.mockResolvedValueOnce(
      mockSdkError('Segment not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await expectExit1(() =>
      addContactSegmentCommand.parseAsync(
        [
          'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
          '--segment-id',
          '00000000-0000-0000-0000-00000bad0seg',
        ],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('add_segment_error');
  });
});
