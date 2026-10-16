import type { InboxThreadLabelList } from 'resend';
import type { GlobalOpts } from '../../../../lib/client';
import { outputError } from '../../../../lib/output';
import { renderTable } from '../../../../lib/table';

export function requireLabelIds(
  labels: string[] | undefined,
  globalOpts: GlobalOpts,
): string[] {
  if (labels === undefined) {
    outputError(
      {
        message: 'Missing --labels flag. Pass one or more label IDs.',
        code: 'missing_labels',
      },
      { json: globalOpts.json },
    );
  }
  return labels.filter(Boolean);
}

export function printThreadLabels(
  threadId: string,
  list: InboxThreadLabelList,
): void {
  console.log(`Thread labels updated: ${threadId}`);
  console.log(
    renderTable(
      ['Name', 'Color', 'ID'],
      list.data.map((l) => [l.name, l.color, l.id]),
      '(no labels)',
    ),
  );
}
