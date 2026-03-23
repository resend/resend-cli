import type { Segment } from 'resend';
import type { PickerConfig } from '../../lib/prompts';
import { renderTable } from '../../lib/table';

export const segmentPickerConfig: PickerConfig<{
  id: string;
  name: string;
}> = {
  resource: 'segment',
  resourcePlural: 'segments',
  fetchItems: (resend, { limit, after }) =>
    resend.segments.list({ limit, ...(after && { after }) }),
  display: (s) => ({ label: s.name, hint: s.id }),
};

export function renderSegmentsTable(segments: Segment[]): string {
  const rows = segments.map((s) => [s.name, s.id, s.created_at]);
  return renderTable(['Name', 'ID', 'Created'], rows, '(no segments)');
}
