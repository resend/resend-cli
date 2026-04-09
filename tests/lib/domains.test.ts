import { describe, expect, it, vi } from 'vitest';
import { fetchVerifiedDomains } from '../../src/lib/domains';

const makeDomain = (
  id: string,
  name: string,
  status = 'verified',
  sending = 'enabled',
) => ({
  id,
  name,
  status,
  capabilities: { sending },
});

const makeResend = (
  pages: Array<{
    data: ReturnType<typeof makeDomain>[];
    has_more: boolean;
  }>,
) => {
  const listFn = vi.fn();
  pages.forEach((page) => {
    listFn.mockResolvedValueOnce({
      data: { data: page.data, has_more: page.has_more },
      error: null,
    });
  });
  return { domains: { list: listFn } } as Record<string, unknown>;
};

describe('fetchVerifiedDomains', () => {
  it('returns verified sending-enabled domains from a single page', async () => {
    const resend = makeResend([
      {
        data: [
          makeDomain('d1', 'example.com'),
          makeDomain('d2', 'pending.com', 'pending'),
          makeDomain('d3', 'nosend.com', 'verified', 'disabled'),
        ],
        has_more: false,
      },
    ]);

    const result = await fetchVerifiedDomains(resend);
    expect(result).toEqual(['example.com']);
  });

  it('paginates through all pages', async () => {
    const resend = makeResend([
      {
        data: [makeDomain('d1', 'page1.com')],
        has_more: true,
      },
      {
        data: [makeDomain('d2', 'page2.com')],
        has_more: true,
      },
      {
        data: [makeDomain('d3', 'page3.com')],
        has_more: false,
      },
    ]);

    const result = await fetchVerifiedDomains(resend);
    expect(result).toEqual(['page1.com', 'page2.com', 'page3.com']);

    const listFn = resend.domains.list as ReturnType<typeof vi.fn>;
    expect(listFn).toHaveBeenCalledTimes(3);
    expect(listFn).toHaveBeenNthCalledWith(1, undefined);
    expect(listFn).toHaveBeenNthCalledWith(2, { after: 'd1' });
    expect(listFn).toHaveBeenNthCalledWith(3, { after: 'd2' });
  });

  it('returns null when domains.list returns an error', async () => {
    const resend = {
      domains: {
        list: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'restricted_api_key', name: 'restricted_api_key' },
        }),
      },
    } as Record<string, unknown>;

    const result = await fetchVerifiedDomains(resend);
    expect(result).toBeNull();
  });

  it('returns null when domains.list throws', async () => {
    const resend = {
      domains: {
        list: vi.fn().mockRejectedValue(new Error('Network error')),
      },
    } as Record<string, unknown>;

    const result = await fetchVerifiedDomains(resend);
    expect(result).toBeNull();
  });

  it('returns empty array when no domains match the filter', async () => {
    const resend = makeResend([
      {
        data: [
          makeDomain('d1', 'pending.com', 'pending'),
          makeDomain('d2', 'nosend.com', 'verified', 'disabled'),
        ],
        has_more: false,
      },
    ]);

    const result = await fetchVerifiedDomains(resend);
    expect(result).toEqual([]);
  });

  it('returns null when a subsequent page errors', async () => {
    const listFn = vi
      .fn()
      .mockResolvedValueOnce({
        data: { data: [makeDomain('d1', 'page1.com')], has_more: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'rate_limited', name: 'rate_limited' },
      });

    const resend = { domains: { list: listFn } } as Record<string, unknown>;

    const result = await fetchVerifiedDomains(resend);
    expect(result).toBeNull();
  });
});
