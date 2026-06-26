import { describe, expect, it } from 'vitest';
import {
  createCallbackServer,
  getJwtExp,
  parseTokenResponse,
} from '../../src/lib/oauth';

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

describe('createCallbackServer', () => {
  const isPending = async (promise: Promise<unknown>): Promise<boolean> => {
    const marker = Symbol('pending');
    const settled = await Promise.race([
      promise.then(
        () => 'resolved',
        () => 'rejected',
      ),
      new Promise((resolve) => setTimeout(() => resolve(marker), 50)),
    ]);
    return settled === marker;
  };

  it('ignores non-callback requests and keeps waiting for the real callback', async () => {
    const { port, waitForCallback } = await createCallbackServer();
    waitForCallback.catch(() => {});

    const favicon = await fetch(`http://127.0.0.1:${port}/favicon.ico`);
    expect(favicon.status).toBe(404);
    await favicon.text();

    expect(await isPending(waitForCallback)).toBe(true);

    await fetch(`http://127.0.0.1:${port}/oauth/callback?code=c&state=s`).then(
      (r) => r.text(),
    );

    expect(await waitForCallback).toEqual({ code: 'c', state: 's' });
  });

  it('resolves with code and state on the callback path', async () => {
    const { port, waitForCallback } = await createCallbackServer();

    await fetch(
      `http://127.0.0.1:${port}/oauth/callback?code=abc&state=xyz`,
    ).then((r) => r.text());

    expect(await waitForCallback).toEqual({ code: 'abc', state: 'xyz' });
  });
});
