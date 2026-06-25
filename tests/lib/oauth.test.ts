import { describe, expect, it } from 'vitest';
import { getJwtExp, parseTokenResponse } from '../../src/lib/oauth';

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

describe('parseTokenResponse', () => {
  // Mirrors the real /oauth/token response (apps/public-api token.ts): the server
  // returns access_token, token_type, expires_in, refresh_token and scope.
  const valid = {
    access_token: 'header.body.sig',
    token_type: 'Bearer',
    expires_in: 900,
    refresh_token: 'rt_abc',
    scope: 'full_access',
  };

  it('returns the response when all fields are present', () => {
    expect(parseTokenResponse(valid)).toEqual(valid);
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['missing access_token', { ...valid, access_token: undefined }],
    ['empty access_token', { ...valid, access_token: '' }],
    ['missing refresh_token', { ...valid, refresh_token: undefined }],
    ['empty refresh_token', { ...valid, refresh_token: '' }],
    ['missing scope', { ...valid, scope: undefined }],
    ['non-string scope', { ...valid, scope: 123 }],
  ])('throws when the response is %s', (_label, input) => {
    expect(() => parseTokenResponse(input)).toThrow('unexpected response');
  });
});
