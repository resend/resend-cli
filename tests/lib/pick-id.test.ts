import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import type { PickerConfig } from '../../src/lib/prompts';
import { expectExit1, mockExitThrow } from '../helpers';

const mockSelect = vi.fn();
const mockIsCancel = vi.fn(() => false);
const mockLogWarn = vi.fn();
const mockLogInfo = vi.fn();

vi.mock('@clack/prompts', () => ({
  select: (...args: unknown[]) => mockSelect(...args),
  isCancel: (...args: unknown[]) => mockIsCancel(...args),
  cancel: vi.fn(),
  log: {
    warn: (...args: unknown[]) => mockLogWarn(...args),
    info: (...args: unknown[]) => mockLogInfo(...args),
  },
}));

vi.mock('../../src/lib/client', () => ({
  requireClient: vi.fn(async () => ({})),
}));

vi.mock('../../src/lib/spinner', () => ({
  createSpinner: () => ({
    update: vi.fn(),
    stop: vi.fn(),
    clear: vi.fn(),
    warn: vi.fn(),
    fail: vi.fn(),
  }),
}));

const originalStdinIsTTY = process.stdin.isTTY;
const originalStdoutIsTTY = process.stdout.isTTY;

let errorSpy: MockInstance | undefined;
let exitSpy: MockInstance | undefined;

const setTTY = (value: boolean | undefined) => {
  Object.defineProperty(process.stdin, 'isTTY', { value, writable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value, writable: true });
};

const makeItem = (id: string, status = 'draft') => ({
  id,
  name: `Item ${id}`,
  status,
});

const makeConfig = (
  pages: Array<{
    data: Array<{ id: string; name: string; status: string }>;
    has_more: boolean;
  }>,
  filter?: (item: { id: string; name: string; status: string }) => boolean,
): PickerConfig<{ id: string; name: string; status: string }> => {
  const fetchFn = vi.fn();
  pages.forEach((page) => {
    fetchFn.mockResolvedValueOnce({ data: page, error: null });
  });
  return {
    resource: 'item',
    resourcePlural: 'items',
    fetchItems: fetchFn,
    display: (item) => ({ label: item.name, hint: item.id }),
    ...(filter && { filter }),
  };
};

beforeEach(() => {
  setTTY(true);
  delete process.env.CI;
  delete process.env.GITHUB_ACTIONS;
  delete process.env.TERM;
  mockSelect.mockReset();
  mockIsCancel.mockReset().mockReturnValue(false);
  mockLogWarn.mockReset();
  mockLogInfo.mockReset();
});

afterEach(() => {
  errorSpy?.mockRestore();
  exitSpy?.mockRestore();
  errorSpy = undefined;
  exitSpy = undefined;
  Object.defineProperty(process.stdin, 'isTTY', {
    value: originalStdinIsTTY,
    writable: true,
  });
  Object.defineProperty(process.stdout, 'isTTY', {
    value: originalStdoutIsTTY,
    writable: true,
  });
});

describe('pickId page-based picker', () => {
  it('selects an item from the first page', async () => {
    const config = makeConfig([
      { data: [makeItem('1'), makeItem('2')], has_more: false },
    ]);
    mockSelect.mockResolvedValueOnce('1');

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(undefined, config, {});

    expect(result).toBe('1');
    expect(config.fetchItems).toHaveBeenCalledTimes(1);
  });

  it('navigates to the next page and selects', async () => {
    const config = makeConfig([
      { data: [makeItem('1'), makeItem('2')], has_more: true },
      { data: [makeItem('3'), makeItem('4')], has_more: false },
    ]);
    mockSelect
      .mockResolvedValueOnce('__next_page__')
      .mockResolvedValueOnce('3');

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(undefined, config, {});

    expect(result).toBe('3');
    expect(config.fetchItems).toHaveBeenCalledTimes(2);
  });

  it('navigates back to a previous page', async () => {
    const config = makeConfig([
      { data: [makeItem('1'), makeItem('2')], has_more: true },
      { data: [makeItem('3'), makeItem('4')], has_more: false },
      { data: [makeItem('1'), makeItem('2')], has_more: true },
    ]);
    mockSelect
      .mockResolvedValueOnce('__next_page__')
      .mockResolvedValueOnce('__prev_page__')
      .mockResolvedValueOnce('2');

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(undefined, config, {});

    expect(result).toBe('2');
    expect(config.fetchItems).toHaveBeenCalledTimes(3);
  });

  it('does not auto-fetch when filter yields empty page', async () => {
    const config = makeConfig(
      [
        {
          data: [makeItem('1', 'sent'), makeItem('2', 'sent')],
          has_more: true,
        },
      ],
      (item) => item.status === 'draft',
    );
    mockSelect.mockResolvedValueOnce('__next_page__');
    const secondPage = { data: [makeItem('3', 'draft')], has_more: false };
    (config.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: secondPage,
      error: null,
    });
    mockSelect.mockResolvedValueOnce('3');

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(undefined, config, {});

    expect(result).toBe('3');
    expect(config.fetchItems).toHaveBeenCalledTimes(2);
    expect(mockLogInfo).toHaveBeenCalledWith('No matching items on this page.');
  });

  it('only keeps current page items in options (no accumulation)', async () => {
    const config = makeConfig([
      { data: [makeItem('1'), makeItem('2')], has_more: true },
      { data: [makeItem('3'), makeItem('4')], has_more: false },
    ]);
    mockSelect
      .mockResolvedValueOnce('__next_page__')
      .mockResolvedValueOnce('3');

    const { pickId } = await import('../../src/lib/prompts');
    await pickId(undefined, config, {});

    const secondCallOptions = mockSelect.mock.calls[1][0].options;
    const itemValues = secondCallOptions
      .map((o: { value: string }) => o.value)
      .filter((v: string) => !v.startsWith('__'));
    expect(itemValues).toEqual(['3', '4']);
    expect(itemValues).not.toContain('1');
    expect(itemValues).not.toContain('2');
  });

  it('shows Next page option when has_more is true', async () => {
    const config = makeConfig([{ data: [makeItem('1')], has_more: true }]);
    mockSelect.mockResolvedValueOnce('1');

    const { pickId } = await import('../../src/lib/prompts');
    await pickId(undefined, config, {});

    const options = mockSelect.mock.calls[0][0].options;
    const labels = options.map((o: { label: string }) => o.label);
    expect(labels).toContain('Next page \u2192');
  });

  it('shows Previous page option on pages after the first', async () => {
    const config = makeConfig([
      { data: [makeItem('1')], has_more: true },
      { data: [makeItem('2')], has_more: false },
    ]);
    mockSelect
      .mockResolvedValueOnce('__next_page__')
      .mockResolvedValueOnce('2');

    const { pickId } = await import('../../src/lib/prompts');
    await pickId(undefined, config, {});

    const firstPageOptions = mockSelect.mock.calls[0][0].options;
    const firstLabels = firstPageOptions.map((o: { label: string }) => o.label);
    expect(firstLabels).not.toContain('\u2190 Previous page');

    const secondPageOptions = mockSelect.mock.calls[1][0].options;
    const secondLabels = secondPageOptions.map(
      (o: { label: string }) => o.label,
    );
    expect(secondLabels).toContain('\u2190 Previous page');
  });

  it('errors with no_items when no items exist and not optional', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    const config = makeConfig([{ data: [], has_more: false }]);

    const { pickId } = await import('../../src/lib/prompts');
    await expectExit1(() => pickId(undefined, config, {}));

    const logOutput = errorSpy?.mock.calls.map((c) => c[0]).join(' ') ?? '';
    const errOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join(' ');
    const output = `${logOutput} ${errOutput}`;
    expect(output).toContain('No items found');
    consoleErrorSpy.mockRestore();
  });

  it('returns undefined when no items and optional', async () => {
    const config = makeConfig([{ data: [], has_more: false }]);

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(undefined, config, {}, { optional: true });

    expect(result).toBeUndefined();
  });

  it('fetches only one page per user action with filter', async () => {
    const config = makeConfig(
      [
        {
          data: [makeItem('1', 'sent'), makeItem('2', 'sent')],
          has_more: true,
        },
      ],
      (item) => item.status === 'draft',
    );

    mockSelect.mockResolvedValueOnce('__next_page__');
    (config.fetchItems as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { data: [makeItem('3', 'draft')], has_more: false },
      error: null,
    });
    mockSelect.mockResolvedValueOnce('3');

    const { pickId } = await import('../../src/lib/prompts');
    const result = await pickId(undefined, config, {});

    expect(result).toBe('3');
    expect(config.fetchItems).toHaveBeenCalledTimes(2);
  });

  it('passes correct cursor for pagination', async () => {
    const config = makeConfig([
      { data: [makeItem('a'), makeItem('b')], has_more: true },
      { data: [makeItem('c')], has_more: false },
    ]);
    mockSelect
      .mockResolvedValueOnce('__next_page__')
      .mockResolvedValueOnce('c');

    const { pickId } = await import('../../src/lib/prompts');
    await pickId(undefined, config, {});

    expect(config.fetchItems).toHaveBeenCalledTimes(2);
    const secondCall = (config.fetchItems as ReturnType<typeof vi.fn>).mock
      .calls[1];
    expect(secondCall[1]).toEqual({ limit: 20, after: 'b' });
  });
});
