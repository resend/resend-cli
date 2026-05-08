import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRetry } from '../../src/lib/with-retry';

describe('withRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
  });

  it('uses retry-after header with HTTP-date value', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-14T12:00:00Z') });

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: { 'retry-after': 'Tue, 14 Apr 2026 12:00:05 GMT' },
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
    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('treats past HTTP-date retry-after as zero delay', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-14T12:00:10Z') });

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: { 'retry-after': 'Tue, 14 Apr 2026 12:00:05 GMT' },
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
    await vi.advanceTimersByTimeAsync(0);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('falls back to default backoff for unparseable retry-after', async () => {
    vi.useFakeTimers();

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: { 'retry-after': 'soon' },
    };
    const success = { data: { id: '1' }, error: null, headers: null };

    const call = vi
      .fn()
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call);
    await vi.advanceTimersByTimeAsync(0);
    expect(call).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('retries immediately when retry-after is "0"', async () => {
    vi.useFakeTimers();

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: { 'retry-after': '0' },
    };
    const success = { data: { id: '1' }, error: null, headers: null };

    const call = vi
      .fn()
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call);
    await vi.advanceTimersByTimeAsync(0);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('falls back to default backoff when retry-after header is missing', async () => {
    vi.useFakeTimers();

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: {},
    };
    const success = { data: { id: '1' }, error: null, headers: null };

    const call = vi
      .fn()
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('invokes onRetry with attempt, delay, and error name', async () => {
    vi.useFakeTimers();

    const rateLimitError = {
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
      headers: { 'retry-after': '3' },
    };
    const success = { data: { id: '1' }, error: null, headers: null };

    const call = vi
      .fn()
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(success);

    const onRetry = vi.fn();
    const resultPromise = withRetry(call, { onRetry });
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);
    await resultPromise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 0, 3, 'rate_limit_exceeded');
    expect(onRetry).toHaveBeenNthCalledWith(2, 1, 3, 'rate_limit_exceeded');
  });
});

describe('withRetry transient 5xx', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const transientError = (name: string) => ({
    data: null,
    error: { message: 'Server error', name },
    headers: null,
  });
  const success = { data: { id: '1' }, error: null, headers: null };

  it.each([
    'internal_server_error',
    'service_unavailable',
    'gateway_timeout',
  ])('retries %s when retryTransient is true', async (name) => {
    vi.useFakeTimers();

    const call = vi
      .fn()
      .mockResolvedValueOnce(transientError(name))
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call, { retryTransient: true });
    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('does not retry transient errors when retryTransient is false', async () => {
    const call = vi
      .fn()
      .mockResolvedValue(transientError('internal_server_error'));

    const result = await withRetry(call);

    expect(result.error?.name).toBe('internal_server_error');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('exhausts transient retries after max attempts', async () => {
    vi.useFakeTimers();

    const call = vi.fn().mockResolvedValue(transientError('gateway_timeout'));

    const resultPromise = withRetry(call, { retryTransient: true });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    const result = await resultPromise;
    expect(result.error?.name).toBe('gateway_timeout');
    expect(call).toHaveBeenCalledTimes(4);
  });

  it('uses retry-after header for transient errors', async () => {
    vi.useFakeTimers();

    const call = vi
      .fn()
      .mockResolvedValueOnce({
        ...transientError('service_unavailable'),
        headers: { 'retry-after': '3' },
      })
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call, { retryTransient: true });
    await vi.advanceTimersByTimeAsync(3000);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('uses default backoff for transient errors without retry-after', async () => {
    vi.useFakeTimers();

    const call = vi
      .fn()
      .mockResolvedValueOnce(transientError('internal_server_error'))
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call, { retryTransient: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(call).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('shares retry counter across rate-limit and transient errors', async () => {
    vi.useFakeTimers();

    const call = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
        headers: null,
      })
      .mockResolvedValueOnce(transientError('internal_server_error'))
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call, { retryTransient: true });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('passes transient error name to onRetry', async () => {
    vi.useFakeTimers();

    const call = vi
      .fn()
      .mockResolvedValueOnce({
        ...transientError('gateway_timeout'),
        headers: { 'retry-after': '2' },
      })
      .mockResolvedValueOnce(success);

    const onRetry = vi.fn();
    const resultPromise = withRetry(call, {
      retryTransient: true,
      onRetry,
    });
    await vi.advanceTimersByTimeAsync(2000);
    await resultPromise;

    expect(onRetry).toHaveBeenCalledWith(0, 2, 'gateway_timeout');
  });

  it('still retries rate_limit_exceeded even without retryTransient', async () => {
    vi.useFakeTimers();

    const call = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
        headers: null,
      })
      .mockResolvedValueOnce(success);

    const resultPromise = withRetry(call);
    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;
    expect(result.data).toEqual({ id: '1' });
    expect(call).toHaveBeenCalledTimes(2);
  });
});
