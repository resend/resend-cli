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

const mockRemoveSegment = vi.fn(async () => ({
  data: { id: '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d', deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    contacts = {
      segments: { remove: mockRemoveSegment },
    };
  },
}));

describe('contacts remove-segment command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemoveSegment.mockClear();
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

  test('removes contact from segment by contact ID', async () => {
    spies = setupOutputSpies();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await removeContactSegmentCommand.parseAsync(
      [
        'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
      ],
      { from: 'user' },
    );

    expect(mockRemoveSegment).toHaveBeenCalledTimes(1);
    const args = mockRemoveSegment.mock.calls[0][0] as Record<string, unknown>;
    expect(args.contactId).toBe('a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6');
    expect(args.segmentId).toBe('7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d');
  });

  test('removes contact from segment by email', async () => {
    spies = setupOutputSpies();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await removeContactSegmentCommand.parseAsync(
      ['jane@example.com', '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d'],
      { from: 'user' },
    );

    const args = mockRemoveSegment.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
    expect(args.segmentId).toBe('7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d');
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await removeContactSegmentCommand.parseAsync(
      [
        'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
        '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
      ],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d');
    expect(parsed.deleted).toBe(true);
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await expectExit1(() =>
      removeContactSegmentCommand.parseAsync(
        [
          'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
          '7b1e0a3d-4c5f-4e8a-9b2d-1a3c5e7f9b2d',
        ],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with remove_segment_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemoveSegment.mockResolvedValueOnce(
      mockSdkError('Not found', 'not_found'),
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await expectExit1(() =>
      removeContactSegmentCommand.parseAsync(
        [
          'a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6',
          '00000000-0000-0000-0000-00000bad0seg',
        ],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('remove_segment_error');
  });
});
