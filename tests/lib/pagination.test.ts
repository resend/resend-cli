import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockInstance,
  test,
  vi,
} from 'vitest';
import { printPaginationHint } from '../../src/lib/pagination';

describe('printPaginationHint', () => {
  let logSpy: MockInstance;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('does not print when has_more is false', () => {
    printPaginationHint(
      { has_more: false, data: [{ id: 'item_1' }] },
      'emails list',
      {},
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('does not print when data is empty', () => {
    printPaginationHint({ has_more: true, data: [] }, 'emails list', {});
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('prints forward pagination hint with --after flag', () => {
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

  test('prints backward pagination hint with --before flag when before is set', () => {
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

  test('includes --limit flag when limit is set', () => {
    printPaginationHint(
      { has_more: true, data: [{ id: 'item_1' }] },
      'emails list',
      { limit: 25 },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend emails list --after item_1 --limit 25',
    );
  });

  test('masks the API key in the hint', () => {
    printPaginationHint(
      { has_more: true, data: [{ id: 'item_1' }] },
      'emails list',
      { apiKey: 're_1234567890abcdef' },
    );
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).not.toContain('re_1234567890abcdef');
    expect(output).toContain('--api-key re_...cdef');
  });

  test('includes --profile flag when profile is set', () => {
    printPaginationHint(
      { has_more: true, data: [{ id: 'item_1' }] },
      'emails list',
      { profile: 'staging' },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend emails list --after item_1 --profile staging',
    );
  });

  test('includes all flags together', () => {
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
