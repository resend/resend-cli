import type { ContactImport, ContactImportColumnMap } from 'resend';
import type { GlobalOpts } from '../../../lib/client';
import { outputError } from '../../../lib/output';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable } from '../../../lib/table';

// ─── Table renderer ────────────────────────────────────────────────────────

export function renderContactImportsTable(imports: ContactImport[]): string {
  const rows = imports.map((imp) => [
    imp.status,
    String(imp.counts.total),
    String(imp.counts.created),
    String(imp.counts.updated),
    String(imp.counts.skipped),
    String(imp.counts.failed),
    imp.created_at,
    imp.id,
  ]);
  return renderTable(
    [
      'Status',
      'Total',
      'Created',
      'Updated',
      'Skipped',
      'Failed',
      'Created At',
      'ID',
    ],
    rows,
    '(no contact imports)',
  );
}

export const contactImportPickerConfig: PickerConfig<ContactImport> = {
  resource: 'contact import',
  resourcePlural: 'contact imports',
  fetchItems: (resend, { limit, after }) =>
    resend.contacts.imports.list({ limit, ...(after && { after }) }),
  display: (imp) => ({
    label: `${imp.status} - ${imp.counts.total} contacts`,
    hint: imp.id,
  }),
};

// ─── JSON flag helpers ───────────────────────────────────────────────────────

export function parseColumnMapJson(
  raw: string | undefined,
  globalOpts: GlobalOpts,
): ContactImportColumnMap | undefined {
  if (!raw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    outputError(
      { message: 'Invalid --column-map JSON.', code: 'invalid_column_map' },
      { json: globalOpts.json },
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    outputError(
      {
        message:
          'Invalid --column-map JSON. Expected an object mapping contact fields to CSV column headers.',
        code: 'invalid_column_map',
      },
      { json: globalOpts.json },
    );
  }
  return parsed as ContactImportColumnMap;
}
