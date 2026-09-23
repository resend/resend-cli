import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { updateInboxLabelCommand } from '../../../../src/commands/inboxes/labels/update';
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

const mockUpdate = vi.fn(async () => ({
  data: { object: 'inbox_label' as const, id: LABEL_ID },
  error: null,
}));

vi.mock('resend', async (importOriginal) => {
  const original = await importOriginal<typeof import('resend')>();
  return {
    INBOX_LABEL_COLORS: original.INBOX_LABEL_COLORS,
    Resend: class MockResend {
      constructor(public key: string) {}
      inboxes = { labels: { update: mockUpdate } };
    },
  };
});

describe('inboxes labels update command', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockUpdate.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('updates name and color', async () => {
    setupOutputSpies();

    await updateInboxLabelCommand.parseAsync(
      [
        '--inbox_id',
        INBOX_ID,
        '--label_id',
        LABEL_ID,
        '--name',
        'Renamed',
        '--color',
        'crimson',
      ],
      { from: 'user' },
    );

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.inboxId).toBe(INBOX_ID);
    expect(args.labelId).toBe(LABEL_ID);
    expect(args.name).toBe('Renamed');
    expect(args.color).toBe('crimson');
  });

  it('errors with no_changes when no option is given', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxLabelCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--label_id', LABEL_ID],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('no_changes');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('errors with update_error when SDK returns an error', async () => {
    setNonInteractive();
    mockUpdate.mockResolvedValueOnce(
      mockSdkError('Label not found.', 'not_found') as never,
    );
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      updateInboxLabelCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--label_id', LABEL_ID, '--name', 'Renamed'],
        { from: 'user' },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('update_error');
  });
});
