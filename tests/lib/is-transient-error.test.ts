import { describe, expect, it } from 'vitest';
import { isTransientError } from '../../src/lib/is-transient-error';

describe('isTransientError', () => {
  it('returns true for internal_server_error', () => {
    expect(isTransientError('internal_server_error')).toBe(true);
  });

  it('returns true for service_unavailable', () => {
    expect(isTransientError('service_unavailable')).toBe(true);
  });

  it('returns true for gateway_timeout', () => {
    expect(isTransientError('gateway_timeout')).toBe(true);
  });

  it('returns false for rate_limit_exceeded', () => {
    expect(isTransientError('rate_limit_exceeded')).toBe(false);
  });

  it('returns false for not_found', () => {
    expect(isTransientError('not_found')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isTransientError(undefined)).toBe(false);
  });
});
