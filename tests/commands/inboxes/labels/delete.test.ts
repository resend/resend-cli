import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { deleteInboxLabelCommand } from '../../../../src/commands/inboxes/labels/delete';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../../helpers';

const INBOX_ID = '78261eea-8f8b-4381-83c6-79fa7120f1cf';
const LABEL_ID = '11111111-2222-3333-4444-555555555555';

const mockRemove = vi.fn(async () => ({
  data: { object: 'inbox_label' as const, id: LABEL_ID, deleted: true },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    inboxes = { labels: { remove: mockRemove } };
  },
}));

describe('inboxes labels delete command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockRemove.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    spies = undefined;
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('deletes a label with --yes and outputs synthesized JSON', async () => {
    spies = setupOutputSpies();

    await deleteInboxLabelCommand.parseAsync(
      ['--inbox_id', INBOX_ID, '--label_id', LABEL_ID, '--yes'],
      {
        from: 'user',
      },
    );

    expect(mockRemove).toHaveBeenCalledWith({
      inboxId: INBOX_ID,
      labelId: LABEL_ID,
    });
    const output = spies.logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('inbox_label');
    expect(parsed.deleted).toBe(true);
  });

  it('errors with confirmation_required when --yes absent in non-interactive mode', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(() =>
      deleteInboxLabelCommand.parseAsync(
        ['--inbox_id', INBOX_ID, '--label_id', LABEL_ID],
        {
          from: 'user',
        },
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('confirmation_required');
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
