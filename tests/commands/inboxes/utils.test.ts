import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { resolveIdInputs } from '../../../src/commands/inboxes/utils';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
} from '../../helpers';

describe('resolveIdInputs', () => {
  const restoreEnv = captureTestEnv();
  let errorSpy: MockInstance | undefined;
  let exitSpy: MockInstance | undefined;

  afterEach(() => {
    restoreEnv();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
    errorSpy = undefined;
    exitSpy = undefined;
  });

  it('takes each ID from the argument or the flag', () => {
    expect(
      resolveIdInputs(
        {
          inbox: ['inbox-1', undefined],
          thread: [undefined, 'thread-1'],
          email: [undefined, undefined],
        },
        {},
      ),
    ).toStrictEqual({
      inbox: 'inbox-1',
      thread: 'thread-1',
      email: undefined,
    });
  });

  it('errors with invalid_options when an ID is given twice', async () => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(async () =>
      resolveIdInputs(
        {
          inbox: ['inbox-1', undefined],
          thread: ['thread-1', 'thread-1'],
        },
        {},
      ),
    );

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_options');
    expect(output).toContain('--thread-id');
    expect(output).toContain('<inboxId> <threadId>');
  });
});
