import { describe, expect, it, vi } from 'vitest';
import {
  oauthGrantPickerConfig,
  renderOAuthGrantsTable,
} from '../../../src/commands/oauth-grants/utils';

const grant = {
  id: 'grant-1',
  client_id: 'client-1',
  scopes: ['emails:send'],
  resource: null,
  created_at: '2026-01-01T00:00:00.000Z',
  revoked_at: null,
  revoked_reason: null,
  client: { name: 'Resend CLI', logo_uri: null },
};

describe('oauthGrantPickerConfig', () => {
  it('forwards limit and after to resend.oauthGrants.list', async () => {
    const mockList = vi.fn(async () => ({
      data: { data: [grant], has_more: true },
      error: null,
    }));
    const resend = { oauthGrants: { list: mockList } } as never;

    const result = await oauthGrantPickerConfig.fetchItems(resend, {
      limit: 20,
      after: 'cursor-abc',
    });

    expect(mockList).toHaveBeenCalledWith({ limit: 20, after: 'cursor-abc' });
    expect(result.data?.has_more).toBe(true);
  });

  it('omits after when not provided', async () => {
    const mockList = vi.fn(async () => ({
      data: { data: [grant], has_more: false },
      error: null,
    }));
    const resend = { oauthGrants: { list: mockList } } as never;

    await oauthGrantPickerConfig.fetchItems(resend, { limit: 20 });

    expect(mockList).toHaveBeenCalledWith({ limit: 20 });
  });

  it('displays the client name as label and id as hint', () => {
    const display = oauthGrantPickerConfig.display(grant);
    expect(display).toEqual({ label: 'Resend CLI', hint: 'grant-1' });
  });
});

describe('renderOAuthGrantsTable', () => {
  it('renders client, scopes, and revocation status', () => {
    const table = renderOAuthGrantsTable([
      grant,
      {
        ...grant,
        id: 'grant-2',
        scopes: ['emails:send', 'domains:read'],
        revoked_at: '2026-01-02T00:00:00.000Z',
        revoked_reason: 'revoked_from_api',
      },
    ]);

    expect(table).toContain('Resend CLI');
    expect(table).toContain('grant-1');
    expect(table).toContain('emails:send, domains:read');
    expect(table).toContain('2026-01-02T00:00:00.000Z');
  });

  it('shows an empty message when there are no grants', () => {
    expect(renderOAuthGrantsTable([])).toContain('(no OAuth grants)');
  });
});
