import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { parseHeaderPairs } from '../../src/lib/headers';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
} from '../helpers';

describe('parseHeaderPairs', () => {
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

  it('returns undefined without values', () => {
    expect(parseHeaderPairs(undefined, {})).toBeUndefined();
  });

  it('splits each pair on the first equals sign', () => {
    expect(
      parseHeaderPairs(['X-Entity-Ref-ID=123', 'X-Query=a=b', 'X-Empty='], {}),
    ).toStrictEqual({
      'X-Entity-Ref-ID': '123',
      'X-Query': 'a=b',
      'X-Empty': '',
    });
  });

  it('keeps the last value for a repeated name', () => {
    expect(parseHeaderPairs(['X-A=1', 'X-A=2'], {})).toStrictEqual({
      'X-A': '2',
    });
  });

  it.each([
    'no-equals',
    '=value',
  ])('errors with invalid_header for "%s"', async (pair) => {
    setNonInteractive();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = mockExitThrow();

    await expectExit1(async () => parseHeaderPairs([pair], {}));

    const output = errorSpy.mock.calls.map((c) => c[0]).join(' ');
    expect(output).toContain('invalid_header');
    expect(output).toContain(pair);
  });
});
