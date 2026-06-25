import { describe, expect, it } from 'vitest';
import { getJwtExp } from '../../src/lib/oauth';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

describe('getJwtExp', () => {
  it('returns the exp claim from a valid JWT', () => {
    expect(getJwtExp(makeJwt({ exp: 1750000000 }))).toBe(1750000000);
  });

  it('throws when the token does not have three segments', () => {
    expect(() => getJwtExp('not-a-jwt')).toThrow('invalid access token');
  });

  it('throws when the payload is not valid base64url JSON', () => {
    expect(() => getJwtExp('header.@@not-json@@.sig')).toThrow(
      'invalid access token',
    );
  });

  it('throws when exp is missing', () => {
    expect(() => getJwtExp(makeJwt({ sub: 'user_123' }))).toThrow(
      'invalid access token',
    );
  });

  it('throws when exp is not a number', () => {
    expect(() => getJwtExp(makeJwt({ exp: 'soon' }))).toThrow(
      'invalid access token',
    );
  });
});
