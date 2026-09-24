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
  data: {
    object: 'inbox_label' as const,
    id: LABEL_ID,
    name: 'Billing',
    color: 'teal' as const,
    created_at: '2026-09-15T00:00:00.000Z',
  },
  error: null,
}));

vi.mock('resend', async (importOriginal) => {
  const original = await importOriginal<typeof import('resend')>();
  return {
    INBOX_LABEL_COLORS: original.INBOX_LABEL_COLORS,
    Resend: class MockResend {
      constructor(public key: string) {}
      inboxes = { labels: { create: mockCreate } };
    },
  };
});

describe('inboxes labels create command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockCreate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('creates a label with --name and --color', async () => {
    setupOutputSpies();

    await createInboxLabelCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--name', 'Billing', '--color', 'teal'],
      { from: 'user' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.inboxId).toBe(INBOX_ID);
    expect(args.name).toBe('Billing');
    expect(args.color).toBe('teal');
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
