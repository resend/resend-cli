import { describe, expect, it } from 'vitest';
import { withTimeout } from '../../src/lib/with-timeout';

describe('withTimeout', () => {
  it('resolves when the promise completes before the deadline', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  it('rejects when the promise exceeds the deadline', async () => {
    const slow = new Promise<string>((resolve) =>
      setTimeout(() => resolve('late'), 5000),
    );
    await expect(withTimeout(slow, 50)).rejects.toThrow(
      'Request timed out after 0.05s',
    );
  });

  it('forwards the original rejection when the promise fails before the deadline', async () => {
    const failing = Promise.reject(new Error('boom'));
    await expect(withTimeout(failing, 1000)).rejects.toThrow('boom');
  });
});
