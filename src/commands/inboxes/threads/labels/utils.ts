import type { InboxThreadLabelList } from 'resend';
import type { GlobalOpts } from '../../../../lib/client';
import { outputError } from '../../../../lib/output';
import { renderTable } from '../../../../lib/table';

export function requireLabelIds(
  labels: string[] | undefined,
  globalOpts: GlobalOpts,
  opts: { allowEmpty: boolean },
): string[] {
  const ids = labels
    ?.flatMap((l) => l.split(','))
    .map((l) => l.trim())
    .filter(Boolean);
  if (ids === undefined || (!opts.allowEmpty && ids.length === 0)) {
    outputError(
      {
        message: opts.allowEmpty
          ? 'Missing --labels flag. Pass one or more label IDs, or --labels "" to remove every label.'
          : 'Missing --labels flag. Pass one or more label IDs.',
        code: 'missing_labels',
      },
      { json: globalOpts.json },
    );
  }
  return ids;
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
