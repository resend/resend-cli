import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../../src/lib/with-retry';

describe('withRetry', () => {
  it('returns the response on success', async () => {
    const call = vi.fn().mockResolvedValue({
      data: { id: '1' },
      error: null,
      headers: null,
    });

    const result = await withRetry(call);

    expect(result.data).toEqual({ id: '1' });
    expect(result.error).toBeNull();
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('returns non-retryable errors immediately', async () => {
    const call = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Server error', name: 'server_error' },
      headers: null,
    });

    const result = await withRetry(call);

    expect(result.error?.message).toBe('Server error');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries rate_limit_exceeded up to 3 times', async () => {
    vi.useFakeTimers();

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: null,
    };
    const success = {
      data: { id: '1' },
      error: null,
      headers: null,
    };

    const call = vi
      .fn()
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('stops retrying after max retries', async () => {
    vi.useFakeTimers();

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: null,
    };

    const call = vi.fn().mockResolvedValue(rateLimitError);

    const resultPromise = withRetry(call);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    const result = await resultPromise;
    expect(result.error?.name).toBe('rate_limit_exceeded');
    expect(call).toHaveBeenCalledTimes(4);

    vi.useRealTimers();
  });

  it('uses retry-after header when available', async () => {
    vi.useFakeTimers();

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: { 'retry-after': '3' },
    };
    const success = {
      data: { id: '1' },
      error: null,
      headers: null,
    };

    const call = vi
      .fn()
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call);
    await vi.advanceTimersByTimeAsync(3000);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
