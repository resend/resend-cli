import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { createInboxLabelCommand } from '../../../../src/commands/inboxes/labels/create';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  mockSdkError,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const LABEL_ID = '11111111-2222-3333-4444-555555555555';

const mockCreate = vi.fn(async () => ({
  data: { object: 'inbox_label' as const, id: LABEL_ID },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { labels: { create: mockCreate } };
  },
}));

describe('inboxes labels create command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;
  let stderrSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    stderrSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
    stderrSpy = undefined;
  });

  it('creates a label with --name and --color', async () => {
    setupOutputSpies();

    await createInboxLabelCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--name', 'Billing', '--color', '#12A594'],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.inboxId).toBe(INBOX_ID);
    expect(args.name).toBe('Billing');
    expect(args.color).toBe('#12A594');
  });

  it('rejects a color that is not a hex code', async () => {
    stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxLabelCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--name', 'Billing', '--color', 'teal'],
        { from: 'user' },
      ),
    );

    const output = stderrSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(output).toContain('Use a hex color like #E93D82.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('omits color when not provided', async () => {
    setupOutputSpies();

    await createInboxLabelCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--name', 'Billing'],
      {
        from: 'user',
      },
    );

    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.color).toBeUndefined();
  });

  it('errors with missing_name when --name absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxLabelCommand.parseAsync(['--inbox_id', INBOX_ID], {
        from: 'user',
      }),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('missing_name');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('errors with create_error when SDK returns an error', async () => {
    setNonInteractive();
    mockCreate.mockResolvedValueOnce(
      mockSdkError('Label limit reached', 'validation_error') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      createInboxLabelCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--name', 'Billing'],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('create_error');
  });
});
