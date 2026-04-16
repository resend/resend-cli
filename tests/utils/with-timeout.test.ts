import { describe, expect, it } from 'vitest';
import { withTimeout } from '../../src/utils/with-timeout';

describe('withTimeout', () => {
  it('resolves when the promise settles before the deadline', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('rejects with TimeoutError when the promise exceeds the deadline', async () => {
    const never = new Promise<string>(() => {});
    await expect(withTimeout(never, 50)).rejects.toThrow(
      'Operation timed out after 50ms',
    );
  });

  it('preserves the original rejection when it arrives before timeout', async () => {
    const failing = Promise.reject(new Error('upstream failure'));
    await expect(withTimeout(failing, 1000)).rejects.toThrow(
      'upstream failure',
    );
  });

  it('sets error name to TimeoutError', async () => {
    const never = new Promise<string>(() => {});
    try {
      await withTimeout(never, 50);
      expect.unreachable('expected rejection');
    } catch (err) {
      expect((err as Error).name).toBe('TimeoutError');
    }
  });
});
