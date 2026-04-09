import { describe, expect, it } from 'vitest';
import { resolveUpstream } from '../../../src/commands/webhooks/resolve-upstream';

describe('resolveUpstream', () => {
  it('returns 200 OK when no forward result is provided', () => {
    expect(resolveUpstream(undefined)).toEqual({ status: 200, body: 'OK' });
  });

  it('returns 200 OK for a 2xx downstream status', () => {
    expect(resolveUpstream({ status: 200 })).toEqual({
      status: 200,
      body: 'OK',
    });
    expect(resolveUpstream({ status: 201 })).toEqual({
      status: 200,
      body: 'OK',
    });
    expect(resolveUpstream({ status: 204 })).toEqual({
      status: 200,
      body: 'OK',
    });
  });

  it('propagates downstream 4xx status', () => {
    expect(resolveUpstream({ status: 401 })).toEqual({
      status: 401,
      body: 'Forward target failed',
    });
    expect(resolveUpstream({ status: 404 })).toEqual({
      status: 404,
      body: 'Forward target failed',
    });
  });

  it('propagates downstream 5xx status', () => {
    expect(resolveUpstream({ status: 500 })).toEqual({
      status: 500,
      body: 'Forward target failed',
    });
    expect(resolveUpstream({ status: 503 })).toEqual({
      status: 503,
      body: 'Forward target failed',
    });
  });

  it('returns 502 for a forwarding error', () => {
    expect(resolveUpstream({ error: 'Connection refused' })).toEqual({
      status: 502,
      body: 'Forward target unreachable',
    });
  });

  it('returns 502 for an unknown forwarding error', () => {
    expect(resolveUpstream({ error: 'Unknown error' })).toEqual({
      status: 502,
      body: 'Forward target unreachable',
    });
  });

  it('treats boundary status 300 as failure', () => {
    expect(resolveUpstream({ status: 300 })).toEqual({
      status: 300,
      body: 'Forward target failed',
    });
  });

  it('treats boundary status 199 as failure', () => {
    expect(resolveUpstream({ status: 199 })).toEqual({
      status: 199,
      body: 'Forward target failed',
    });
  });
});
