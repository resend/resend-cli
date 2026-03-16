import { describe, expect, type MockInstance, test, vi } from 'vitest';
import { printPaginationHint } from '../../src/lib/pagination';

describe('printPaginationHint', () => {
  let logSpy: MockInstance;

  function setup() {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  }

  test('does not print when has_more is false', () => {
    setup();
    printPaginationHint(
      { has_more: false, data: [{ id: 'item_1' }] },
      'emails list',
      {},
    );
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('does not print when data is empty', () => {
    setup();
    printPaginationHint({ has_more: true, data: [] }, 'emails list', {});
    expect(logSpy).not.toHaveBeenCalled();
  });

  test('prints forward pagination hint with --after flag', () => {
    setup();
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
    setup();
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
    setup();
    printPaginationHint(
      { has_more: true, data: [{ id: 'item_1' }] },
      'emails list',
      { limit: 25 },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend emails list --after item_1 --limit 25',
    );
  });

  test('includes --api-key flag when apiKey is set', () => {
    setup();
    printPaginationHint(
      { has_more: true, data: [{ id: 'item_1' }] },
      'emails list',
      { apiKey: 're_123' },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend emails list --after item_1 --api-key re_123',
    );
  });

  test('includes --profile flag when profile is set', () => {
    setup();
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
    setup();
    printPaginationHint(
      {
        has_more: true,
        data: [{ id: 'item_1' }, { id: 'item_2' }],
      },
      'contacts list',
      { limit: 10, apiKey: 're_abc', profile: 'prod', before: 'item_5' },
    );
    expect(logSpy).toHaveBeenCalledWith(
      '\nFetch the next page:\n$ resend contacts list --before item_1 --limit 10 --api-key re_abc --profile prod',
    );
  });
});
