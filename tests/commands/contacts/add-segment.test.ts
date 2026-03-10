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

const mockAddSegment = mock(async () => ({
  data: { id: 'seg_123' },
  error: null,
}));

mock.module('resend', () => ({
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
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockAddSegment.mockClear();
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

  test('adds contact to segment by contact ID', async () => {
    spies = setupOutputSpies();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await addContactSegmentCommand.parseAsync(
      ['contact_abc123', '--segment-id', 'seg_123'],
      { from: 'user' },
    );

    expect(mockAddSegment).toHaveBeenCalledTimes(1);
    const args = mockAddSegment.mock.calls[0][0] as Record<string, unknown>;
    expect(args.contactId).toBe('contact_abc123');
    expect(args.segmentId).toBe('seg_123');
  });

  test('adds contact to segment by email', async () => {
    spies = setupOutputSpies();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await addContactSegmentCommand.parseAsync(
      ['jane@example.com', '--segment-id', 'seg_123'],
      { from: 'user' },
    );

    const args = mockAddSegment.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
    expect(args.segmentId).toBe('seg_123');
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await addContactSegmentCommand.parseAsync(
      ['contact_abc123', '--segment-id', 'seg_123'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('seg_123');
  });

  test('errors with missing_segment_id when --segment-id absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await expectExit1(() =>
      addContactSegmentCommand.parseAsync(['contact_abc123'], { from: 'user' }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_segment_id');
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await expectExit1(() =>
      addContactSegmentCommand.parseAsync(
        ['contact_abc123', '--segment-id', 'seg_123'],
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
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { addContactSegmentCommand } = await import(
      '../../../src/commands/contacts/add-segment'
    );
    await expectExit1(() =>
      addContactSegmentCommand.parseAsync(
        ['contact_abc123', '--segment-id', 'bad_seg'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('add_segment_error');
  });
});
