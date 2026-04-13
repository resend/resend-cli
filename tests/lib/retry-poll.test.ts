import { describe, expect, it } from 'vitest';
import { retryPoll } from '../../src/lib/retry-poll';

const noDelay = (_ms: number) => Promise.resolve();

const makeResponse = <T>(data: T) => ({
  data,
  error: null,
  headers: null,
});

const makeError = (message: string, name?: string) => ({
  data: null,
  error: { message, name },
  headers: null,
});

const makeRateLimited = (retryAfter?: string) => ({
  data: null,
  error: { message: 'Rate limited', name: 'rate_limit_exceeded' },
  headers: retryAfter ? { 'retry-after': retryAfter } : null,
});

describe('retryPoll', () => {
  it('returns data on first successful call', async () => {
    const result = await retryPoll(
      () => Promise.resolve(makeResponse({ id: '1' })),
      { delayMs: noDelay },
    );

    expect(result).toEqual({ success: true, data: { id: '1' } });
  });

  it('returns failure for non-retryable SDK error', async () => {
    const result = await retryPoll(
      () => Promise.resolve(makeError('Bad request', 'validation_error')),
      { delayMs: noDelay },
    );

    expect(result).toEqual({ success: false, message: 'Bad request' });
  });

  it('retries rate_limit_exceeded and succeeds', async () => {
    let attempt = 0;
    const result = await retryPoll(
      () => {
        attempt++;
        if (attempt <= 2) {
          return Promise.resolve(makeRateLimited());
        }
        return Promise.resolve(makeResponse({ id: 'ok' }));
      },
      { delayMs: noDelay },
    );

    expect(attempt).toBe(3);
    expect(result).toEqual({ success: true, data: { id: 'ok' } });
  });

  it('fails after exhausting retries on rate_limit_exceeded', async () => {
    let attempt = 0;
    const result = await retryPoll(
      () => {
        attempt++;
        return Promise.resolve(makeRateLimited());
      },
      { delayMs: noDelay },
    );

    expect(attempt).toBe(4);
    expect(result).toEqual({ success: false, message: 'Rate limited' });
  });

  it('retries thrown errors and succeeds', async () => {
    let attempt = 0;
    const result = await retryPoll(
      () => {
        attempt++;
        if (attempt <= 2) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve(makeResponse({ recovered: true }));
      },
      { delayMs: noDelay },
    );

    expect(attempt).toBe(3);
    expect(result).toEqual({ success: true, data: { recovered: true } });
  });

  it('fails after exhausting retries on thrown errors', async () => {
    let attempt = 0;
    const result = await retryPoll(
      () => {
        attempt++;
        return Promise.reject(new Error('Connection refused'));
      },
      { delayMs: noDelay },
    );

    expect(attempt).toBe(4);
    expect(result).toEqual({
      success: false,
      message: 'Connection refused',
    });
  });

  it('uses retry-after header when available', async () => {
    const delays: number[] = [];
    let attempt = 0;
    await retryPoll(
      () => {
        attempt++;
        if (attempt === 1) {
          return Promise.resolve(makeRateLimited('3'));
        }
        return Promise.resolve(makeResponse({ id: 'ok' }));
      },
      {
        delayMs: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
      },
    );

    expect(delays).toEqual([3000]);
  });

  it('returns failure for null data response', async () => {
    const result = await retryPoll(
      () => Promise.resolve({ data: null, error: null, headers: null }),
      { delayMs: noDelay },
    );

    expect(result).toEqual({
      success: false,
      message: 'Unexpected empty response',
    });
  });

  it('handles non-Error thrown values', async () => {
    let attempt = 0;
    const result = await retryPoll(
      () => {
        attempt++;
        return Promise.reject('string error');
      },
      { delayMs: noDelay },
    );

    expect(attempt).toBe(4);
    expect(result).toEqual({ success: false, message: 'Unknown error' });
  });

  it('recovers from mixed rate-limit and thrown errors', async () => {
    let attempt = 0;
    const result = await retryPoll(
      () => {
        attempt++;
        if (attempt === 1) {
          return Promise.resolve(makeRateLimited());
        }
        if (attempt === 2) {
          return Promise.reject(new Error('Network blip'));
        }
        return Promise.resolve(makeResponse({ id: 'recovered' }));
      },
      { delayMs: noDelay },
    );

    expect(attempt).toBe(3);
    expect(result).toEqual({ success: true, data: { id: 'recovered' } });
  });
});
