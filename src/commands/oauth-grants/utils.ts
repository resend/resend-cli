import type { OAuthGrant } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export const oauthGrantPickerConfig: PickerConfig<OAuthGrant> = {
  resource: 'OAuth grant',
  resourcePlural: 'OAuth grants',
  fetchItems: (resend, { limit, after }) =>
    resend.oauthGrants.list({ limit, ...(after && { after }) }),
  display: (g) => ({ label: g.client.name, hint: g.id }),
};

export function renderOAuthGrantsTable(grants: OAuthGrant[]): string {
  const rows = grants.map((g) => [
    g.client.name,
    g.id,
    g.scopes.join(', '),
    g.created_at,
    g.revoked_at ?? '',
  ]);
  return renderTable(
    ['Client', 'ID', 'Scopes', 'Created', 'Revoked'],
    rows,
    '(no OAuth grants)',
  );
}
