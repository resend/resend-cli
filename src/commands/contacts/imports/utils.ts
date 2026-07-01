import type { ContactImport, ContactImportColumnMap } from 'resend';
import type { GlobalOpts } from '../../../lib/client';
import { outputError } from '../../../lib/output';
import type { PickerConfig } from '../../../lib/prompts';
import { renderTable, type StatusTone } from '../../../lib/table';
import { isUnicodeSupported } from '../../../lib/tty';

// ─── Table renderer ────────────────────────────────────────────────────────

// Status symbols generated via String.fromCodePoint() — never literal Unicode in
// source — to prevent UTF-8 → Latin-1 corruption when the npm package is bundled.
const CHECK = isUnicodeSupported ? String.fromCodePoint(0x2713) : 'v'; // ✓
const HOURGLASS = isUnicodeSupported ? String.fromCodePoint(0x23f3) : '~'; // ⏳
const CROSS_MARK = isUnicodeSupported ? String.fromCodePoint(0x2717) : 'x'; // ✗

function importStatusTone(status: string): StatusTone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'queued':
    case 'in_progress':
      return 'pending';
    case 'failed':
      return 'failure';
    default:
      return 'neutral';
  }
}

export function importStatusIndicator(status: string): string {
  switch (status) {
    case 'completed':
      return `${CHECK} Completed`;
    case 'queued':
      return `${HOURGLASS} Queued`;
    case 'in_progress':
      return `${HOURGLASS} In progress`;
    case 'failed':
      return `${CROSS_MARK} Failed`;
    default:
      return status;
  }
}

export function renderContactImportsTable(imports: ContactImport[]): string {
  const rows = imports.map((imp) => [
    importStatusIndicator(imp.status),
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
    {
      statusColumn: {
        index: 0,
        tones: imports.map((imp) => importStatusTone(imp.status)),
      },
    },
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
