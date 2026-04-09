import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PickerConfig } from '../../src/lib/prompts';
import { expectExitCode, mockExitThrow } from '../helpers';

const mockConfirm = vi.fn();
const mockIsCancel = vi.fn(() => false);

vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual('@clack/prompts');
  return {
    ...(actual as object),
    confirm: (...args: unknown[]) => mockConfirm(...args),
    isCancel: (...args: unknown[]) => mockIsCancel(...args),
  };
});

vi.mock('../../src/lib/client', () => ({
  requireClient: vi.fn(async () => ({})),
}));

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;
const originalTERM = process.env.TERM;
const originalCI = process.env.CI;
const originalGITHUB_ACTIONS = process.env.GITHUB_ACTIONS;

const setInteractive = () => {
  Object.defineProperty(process.stdin, 'isTTY', {
    value: true,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    value: true,
    writable: true,
  });
  delete process.env.CI;
  delete process.env.GITHUB_ACTIONS;
  process.env.TERM = 'xterm-256color';
};

const makeErrorConfig = (
  resourceName = 'domain',
  errorMsg = 'Network error',
): PickerConfig<{ id: string; name: string }> => ({
  resource: resourceName,
  resourcePlural: `${resourceName}s`,
  fetchItems: vi.fn(async () => ({
    data: null,
    error: { message: errorMsg },
  })),
  display: (d) => ({ label: d.name, hint: d.id }),
});

afterEach(() => {
  mockConfirm.mockReset();
  mockIsCancel.mockReset();
  Object.defineProperty(process.stdin, 'isTTY', {
    value: originalStdinIsTTY,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    value: originalStdoutIsTTY,
    writable: true,
  });
  process.env.TERM = originalTERM;
  if (originalCI !== undefined) {
    process.env.CI = originalCI;
  } else {
    delete process.env.CI;
  }
  if (originalGITHUB_ACTIONS !== undefined) {
    process.env.GITHUB_ACTIONS = originalGITHUB_ACTIONS;
  } else {
    delete process.env.GITHUB_ACTIONS;
  }
});

describe('pickId optional fetch failure', () => {
  it('returns undefined when user confirms continuing without scope', async () => {
    setInteractive();
    mockConfirm.mockResolvedValue(true);
    mockIsCancel.mockReturnValue(false);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(
      undefined,
      makeErrorConfig(),
      {},
      { optional: true },
    );

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Continue without'),
        initialValue: false,
      }),
    );
    expect(result).toBeUndefined();
  });

  it('exits when user declines continuing without scope', async () => {
    setInteractive();
    mockConfirm.mockResolvedValue(false);
    mockIsCancel.mockReturnValue(false);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockExitThrow();

    const { pickId } = await import('../../src/lib/prompts');

    await expectExitCode(130, () =>
      pickId(undefined, makeErrorConfig(), {}, { optional: true }),
    );
  });

  it('exits when user cancels the confirmation prompt', async () => {
    setInteractive();
    const cancelSymbol = Symbol('cancel');
    mockConfirm.mockResolvedValue(cancelSymbol);
    mockIsCancel.mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockExitThrow();

    const { pickId } = await import('../../src/lib/prompts');

    await expectExitCode(130, () =>
      pickId(undefined, makeErrorConfig(), {}, { optional: true }),
    );
  });

  it('includes the resource name in the confirmation message', async () => {
    setInteractive();
    mockConfirm.mockResolvedValue(true);
    mockIsCancel.mockReturnValue(false);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const { pickId } = await import('../../src/lib/prompts');

    await pickId(undefined, makeErrorConfig('topic'), {}, { optional: true });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('topic'),
      }),
    );
  });
});
