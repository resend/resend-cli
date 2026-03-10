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

const mockRemoveSegment = mock(async () => ({
  data: { id: 'seg_123', deleted: true },
  error: null,
}));

mock.module('resend', () => ({
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
  let errorSpy: ReturnType<typeof spyOn> | undefined;
  let stderrSpy: ReturnType<typeof spyOn> | undefined;
  let exitSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemoveSegment.mockClear();
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

  test('removes contact from segment by contact ID', async () => {
    spies = setupOutputSpies();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await removeContactSegmentCommand.parseAsync(
      ['contact_abc123', 'seg_123'],
      { from: 'user' },
    );

    expect(mockRemoveSegment).toHaveBeenCalledTimes(1);
    const args = mockRemoveSegment.mock.calls[0][0] as Record<string, unknown>;
    expect(args.contactId).toBe('contact_abc123');
    expect(args.segmentId).toBe('seg_123');
  });

  test('removes contact from segment by email', async () => {
    spies = setupOutputSpies();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await removeContactSegmentCommand.parseAsync(
      ['jane@example.com', 'seg_123'],
      { from: 'user' },
    );

    const args = mockRemoveSegment.mock.calls[0][0] as Record<string, unknown>;
    expect(args.email).toBe('jane@example.com');
    expect(args.segmentId).toBe('seg_123');
  });

  test('outputs JSON result when non-interactive', async () => {
    spies = setupOutputSpies();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await removeContactSegmentCommand.parseAsync(
      ['contact_abc123', 'seg_123'],
      { from: 'user' },
    );

    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('seg_123');
    expect(parsed.deleted).toBe(true);
  });

  test('errors with auth_error when no API key', async () => {
    setNonInteractive();
    delete process.env.RESEND_API_KEY;
    process.env.XDG_CONFIG_HOME = '/tmp/nonexistent-resend';
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await expectExit1(() =>
      removeContactSegmentCommand.parseAsync(['contact_abc123', 'seg_123'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('auth_error');
  });

  test('errors with remove_segment_error when SDK returns an error', async () => {
    setNonInteractive();
    mockRemoveSegment.mockResolvedValueOnce(
      mockSdkError('Not found', 'not_found'),
    );
    errorSpy = spyOn(console, 'error').mockImplementation(() => {});
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitSpy = mockExitThrow();

    const { removeContactSegmentCommand } = await import(
      '../../../src/commands/contacts/remove-segment'
    );
    await expectExit1(() =>
      removeContactSegmentCommand.parseAsync(['contact_abc123', 'bad_seg'], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('remove_segment_error');
  });
});
