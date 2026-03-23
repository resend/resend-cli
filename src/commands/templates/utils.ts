import type {
  CreateTemplateOptions,
  ListTemplatesResponseSuccess,
} from 'resend';
import type { PickerConfig } from '../../lib/prompts';

type TemplateVariableCreationOptions = NonNullable<
  CreateTemplateOptions['variables']
>[number];

import { renderTable } from '../../lib/table';

/**
 * Parse `--var` values like "name:string" or "count:number:42" into SDK options.
 */
export function parseVariables(
  vars: string[],
): TemplateVariableCreationOptions[] {
  return vars.map((v) => {
    const [key, type, ...rest] = v.split(':');

    if (!key) {
      throw new Error(`Invalid --var "${v}": key is required.`);
    }
    if (type !== 'string' && type !== 'number') {
      throw new Error(
        `Invalid --var "${v}": type must be "string" or "number".`,
      );
    }

    const raw = rest.length ? rest.join(':') : undefined;
    if (raw != null && raw === '') {
      throw new Error(`Invalid --var "${v}": fallback value cannot be empty.`);
    }
    const fallback = raw;

    if (type === 'number') {
      if (fallback != null && Number.isNaN(Number(fallback))) {
        throw new Error(
          `Invalid --var "${v}": fallback "${fallback}" is not a valid number.`,
        );
      }
      return {
        key,
        type: 'number' as const,
        ...(fallback != null ? { fallbackValue: Number(fallback) } : {}),
      };
    }
    return {
      key,
      type: 'string' as const,
      ...(fallback != null ? { fallbackValue: fallback } : {}),
    };
  });
}

export const templatePickerConfig: PickerConfig<{
  id: string;
  name: string;
}> = {
  resource: 'template',
  resourcePlural: 'templates',
  fetchItems: (resend, { limit, after }) =>
    resend.templates.list({ limit, ...(after && { after }) }),
  display: (t) => ({ label: t.name, hint: t.id }),
};

export function renderTemplatesTable(
  templates: ListTemplatesResponseSuccess['data'],
): string {
  const rows = templates.map((t) => [
    t.name,
    t.status,
    t.alias ?? '',
    t.id,
    t.created_at,
  ]);
  return renderTable(
    ['Name', 'Status', 'Alias', 'ID', 'Created'],
    rows,
    '(no templates)',
  );
}
