import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import type { GlobalOpts } from '../../src/lib/client';
import {
  buildPaginationOpts,
  printPaginationHint,
} from '../../src/lib/pagination';
import { captureTestEnv, mockExitThrow, setNonInteractive } from '../helpers';

describe('buildPaginationOpts', () => {
  const restoreEnv = captureTestEnv();
  let exitSpy: MockInstance | undefined;
  let logSpy: MockInstance | undefined;

  afterEach(() => {
    restoreEnv();
    exitSpy?.mockRestore();
    logSpy?.mockRestore();
    exitSpy = undefined;
    logSpy = undefined;
  });

  const globalOpts = {} as GlobalOpts;

  it('returns limit only when no cursors are provided', () => {
    expect(buildPaginationOpts(10, undefined, undefined, globalOpts)).toEqual({
      limit: 10,
    });
  });

  it('returns after cursor when provided', () => {
    expect(
      buildPaginationOpts(10, 'cursor_after', undefined, globalOpts),
    ).toEqual({
      limit: 10,
      after: 'cursor_after',
    });
  });

  it('returns before cursor when provided', () => {
    expect(
      buildPaginationOpts(10, undefined, 'cursor_before', globalOpts),
    ).toEqual({
      limit: 10,
      before: 'cursor_before',
    });
  });

  it('errors when both after and before cursors are provided', () => {
    setNonInteractive();
    logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    expect(() =>
      buildPaginationOpts(10, 'cursor_after', 'cursor_before', globalOpts),
    ).toThrow();

    const output = logSpy.mock.calls.map((call) => call[0]).join(' ');
    expect(output).toContain('invalid_pagination');
  });
});

describe('printPaginationHint', () => {
  let logSpy: MockInstance;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not print when has_more is false', () => {
    printPaginationHint(
      { has_more: false, data: [{ id: 'item_1' }] },
      'emails list',
      {},
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does not print when data is empty', () => {
    printPaginationHint({ has_more: true, data: [] }, 'emails list', {});
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('prints forward pagination hint with --after flag', () => {
    printPaginationHint(
      {
        has_more: true,
        data: [{ id: 'item_1' }, { id: 'item_2' }, { id: 'item_3' }],
      },
      'emails list',
      {},
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend emails list --after item_3',
    );
  });

  it('prints backward pagination hint with --before flag when before is set', () => {
    printPaginationHint(
      {
        has_more: true,
        data: [{ id: 'item_1' }, { id: 'item_2' }, { id: 'item_3' }],
      },
      'emails list',
      { before: 'item_5' },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend emails list --before item_1',
    );
  });

  it('includes --limit flag when limit is set', () => {
    printPaginationHint(
      { has_more: true, data: [{ id: 'item_1' }] },
      'emails list',
      { limit: 25 },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend emails list --after item_1 --limit 25',
    );
  });

  it('masks the API key in the hint', () => {
    printPaginationHint(
      { has_more: true, data: [{ id: 'item_1' }] },
      'emails list',
      { apiKey: 're_1234567890abcdef' },
    );
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).not.toContain('re_1234567890abcdef');
    expect(output).toContain('--api-key re_...cdef');
  });

  it('includes --profile flag when profile is set', () => {
    printPaginationHint(
      { has_more: true, data: [{ id: 'item_1' }] },
      'emails list',
      { profile: 'staging' },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend emails list --after item_1 --profile staging',
    );
  });

  it('includes all flags together', () => {
    printPaginationHint(
      {
        has_more: true,
        data: [{ id: 'item_1' }, { id: 'item_2' }],
      },
      'contacts list',
      {
        limit: 10,
        apiKey: 're_abcdefghijkl',
        profile: 'prod',
        before: 'item_5',
      },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend contacts list --before item_1 --limit 10 --api-key re_...ijkl --profile prod',
    );
  });
});
