import type { EventSchemaMap } from 'resend';
import { parseJsonFlag } from '../../lib/json';
import { outputError } from '../../lib/output';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

const VALID_SCHEMA_TYPES = new Set(['string', 'number', 'boolean', 'date']);

export function formatSchema(schema: Record<string, string> | null): string {
  if (!schema) {
    return '(none)';
  }
  const entries = Object.entries(schema);
  if (entries.length === 0) {
    return '(empty)';
  }
  return entries.map(([k, v]) => `${k}:${v}`).join(', ');
}

export function renderEventsTable(
  events: Array<{
    id: string;
    name: string;
    schema: Record<string, string> | null;
    created_at: string;
  }>,
): string {
  const rows = events.map((e) => [
    e.name,
    formatSchema(e.schema),
    e.created_at,
    e.id,
  ]);
  return renderTable(['Name', 'Schema', 'Created', 'ID'], rows, '(no events)');
}

export function parseSchemaJson(
  raw: string,
  globalOpts: { json?: boolean },
): EventSchemaMap | null {
  if (raw === 'null') {
    return null;
  }

  const parsed = parseJsonFlag(raw, '--schema', globalOpts);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    outputError(
      {
        message:
          '--schema must be a JSON object mapping field names to types (string | number | boolean | date).',
        code: 'invalid_schema',
      },
      { json: globalOpts.json },
    );
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string' || !VALID_SCHEMA_TYPES.has(value)) {
      outputError(
        {
          message: `Invalid schema type for "${key}": "${value}". Must be one of: string, number, boolean, date.`,
          code: 'invalid_schema',
        },
        { json: globalOpts.json },
      );
    }
  }

  return parsed as EventSchemaMap;
}

export const eventPickerConfig: PickerConfig<{
  id: string;
  name: string;
}> = {
  resource: 'event',
  resourcePlural: 'events',
  fetchItems: (resend, { limit, after }) =>
    resend.events.list({ limit, ...(after && { after }) }),
  display: (e) => ({ label: e.name, hint: e.id }),
};
