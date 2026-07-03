import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureTestEnv, setupOutputSpies } from '../../helpers';

const mockList = vi.fn(async () => ({
  data: {
    object: 'list',
    data: [
      {
        id: 'grant-id-1',
        client_id: 'client-id-1',
        scopes: ['emails:send'],
        resource: null,
        created_at: '2026-01-01T00:00:00.000Z',
        revoked_at: null,
        revoked_reason: null,
        client: { name: 'Resend CLI', logo_uri: null },
      },
      {
        id: 'grant-id-2',
        client_id: 'client-id-1',
        scopes: ['emails:send', 'domains:read'],
        resource: 'https://api.resend.com',
        created_at: '2026-01-02T00:00:00.000Z',
        revoked_at: '2026-01-03T00:00:00.000Z',
        revoked_reason: 'revoked_from_api',
        client: { name: 'Resend CLI', logo_uri: null },
      },
    ],
    has_more: false,
  },
  error: null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    oauthGrants = { list: mockList };
  },
}));

describe('oauth-grants list command', () => {
  const restoreEnv = captureTestEnv();
  let spies: ReturnType<typeof setupOutputSpies> | undefined;

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockList.mockClear();
  });

  afterEach(() => {
    restoreEnv();
    spies = undefined;
  });

  function getFirstCallArgs(): unknown {
    const firstCall = mockList.mock.calls.at(0);
    if (!firstCall) {
      throw new Error('Expected mockList to be called at least once');
    }
    return firstCall[0];
  }

  it('uses default limit of 10 when not specified', async () => {
    spies = setupOutputSpies();

    const { listOAuthGrantsCommand } = await import(
      '../../../src/commands/oauth-grants/list'
    );
    await listOAuthGrantsCommand.parseAsync([], { from: 'user' });

    expect(mockList).toHaveBeenCalledTimes(1);
    expect(getFirstCallArgs()).toMatchObject({ limit: 10 });
  });

  it('outputs JSON list when non-interactive', async () => {
    spies = setupOutputSpies();

    const { listOAuthGrantsCommand } = await import(
      '../../../src/commands/oauth-grants/list'
    );
    await listOAuthGrantsCommand.parseAsync([], { from: 'user' });

    const output = (spies.logSpy.mock.calls[0] as unknown[])[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.object).toBe('list');
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0].id).toBe('grant-id-1');
    expect(parsed.data[0].client.name).toBe('Resend CLI');
    expect(parsed.data[1].revoked_reason).toBe('revoked_from_api');
  });

  it('passes limit to SDK', async () => {
    spies = setupOutputSpies();

    const { listOAuthGrantsCommand } = await import(
      '../../../src/commands/oauth-grants/list'
    );
    await listOAuthGrantsCommand.parseAsync(['--limit', '25'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({ limit: 25 });
  });

  it('passes after cursor to SDK', async () => {
    spies = setupOutputSpies();

    const { listOAuthGrantsCommand } = await import(
      '../../../src/commands/oauth-grants/list'
    );
    await listOAuthGrantsCommand.parseAsync(['--after', 'some-cursor'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({ after: 'some-cursor' });
  });

  it('passes before cursor to SDK', async () => {
    spies = setupOutputSpies();

    const { listOAuthGrantsCommand } = await import(
      '../../../src/commands/oauth-grants/list'
    );
    await listOAuthGrantsCommand.parseAsync(['--before', 'some-cursor'], {
      from: 'user',
    });

    expect(getFirstCallArgs()).toMatchObject({ before: 'some-cursor' });
  });
});
