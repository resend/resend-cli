import type {
  CreateTemplateOptions,
  ListTemplatesResponseSuccess,
} from 'resend';

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
    const fallback = rest.length ? rest.join(':') : undefined;
    if (type === 'number') {
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
