import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('fetch-timeout', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('attaches a timeout signal when no signal is provided', async () => {
    const fakeFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeDefined();
      return Promise.resolve(new Response('ok'));
    });
    globalThis.fetch = fakeFetch as typeof fetch;

    await import('../../src/lib/fetch-timeout');
    await globalThis.fetch('https://example.com');

    expect(fakeFetch).toHaveBeenCalledOnce();
  });

  it('preserves a caller-provided signal alongside the timeout', async () => {
    const callerAbort = new AbortController();
    const fakeFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeDefined();
      expect(init?.signal).not.toBe(callerAbort.signal);
      return Promise.resolve(new Response('ok'));
    });
    globalThis.fetch = fakeFetch as typeof fetch;

    await import('../../src/lib/fetch-timeout');
    await globalThis.fetch('https://example.com', {
      signal: callerAbort.signal,
    });

    expect(fakeFetch).toHaveBeenCalledOnce();
  });

  it('forwards all init options to the underlying fetch', async () => {
    const fakeFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ 'X-Test': '1' });
      return Promise.resolve(new Response('ok'));
    });
    globalThis.fetch = fakeFetch as typeof fetch;

    await import('../../src/lib/fetch-timeout');
    await globalThis.fetch('https://example.com', {
      method: 'POST',
      headers: { 'X-Test': '1' },
    });

    expect(fakeFetch).toHaveBeenCalledOnce();
  });

  it('exports REQUEST_TIMEOUT_MS as 30000', async () => {
    const mod = await import('../../src/lib/fetch-timeout');
    expect(mod.REQUEST_TIMEOUT_MS).toBe(30_000);
  });
});
