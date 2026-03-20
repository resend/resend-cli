import type { Segment } from 'resend';
import { renderTable } from '../../lib/table';

export function renderSegmentsTable(segments: Segment[]): string {
  const rows = segments.map((s) => [s.name, s.id, s.created_at]);
  return renderTable(['Name', 'ID', 'Created'], rows, '(no segments)');
}
