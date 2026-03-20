import { isUnicodeSupported } from './tty';

// All box-drawing characters generated via String.fromCodePoint() — never literal
// Unicode in source — to prevent UTF-8 → Latin-1 corruption in npm bundles.
const BOX = isUnicodeSupported
  ? {
      h: String.fromCodePoint(0x2500), // ─
      v: String.fromCodePoint(0x2502), // │
      tl: String.fromCodePoint(0x250c), // ┌
      tr: String.fromCodePoint(0x2510), // ┐
      bl: String.fromCodePoint(0x2514), // └
      br: String.fromCodePoint(0x2518), // ┘
      lm: String.fromCodePoint(0x251c), // ├
      rm: String.fromCodePoint(0x2524), // ┤
      tm: String.fromCodePoint(0x252c), // ┬
      bm: String.fromCodePoint(0x2534), // ┴
      mm: String.fromCodePoint(0x253c), // ┼
    }
  : {
      h: '-',
      v: '|',
      tl: '+',
      tr: '+',
      bl: '+',
      br: '+',
      lm: '+',
      rm: '+',
      tm: '+',
      bm: '+',
      mm: '+',
    };

export type ColumnOption = { fixed?: boolean };

const MIN_USEFUL_WIDTH = 12;

export function getTerminalWidth(): number | undefined {
  return process.stdout.columns;
}

function renderCards(headers: string[], rows: string[][]): string {
  const labelWidth = Math.max(...headers.map((h) => h.length));
  const sepWidth = Math.max(20, Math.min(getTerminalWidth() ?? 40, 40));

  return rows
    .map((row, idx) => {
      const label = String(idx + 1);
      const sep = `${BOX.h}${BOX.h} ${label} ${BOX.h.repeat(Math.max(0, sepWidth - label.length - 4))}`;
      const fields = headers.map(
        (h, i) => `  ${h.padEnd(labelWidth)}  ${row[i]}`,
      );
      return [sep, ...fields].join('\n');
    })
    .join('\n\n');
}

export function renderTable(
  headers: string[],
  rows: string[][],
  emptyMessage = '(no results)',
  columns?: ColumnOption[],
): string {
  if (rows.length === 0) {
    return emptyMessage;
  }
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );

  const termWidth = getTerminalWidth();
  if (termWidth !== undefined) {
    const N = widths.length;
    const totalWidth = widths.reduce((s, w) => s + w, 0) + 3 * N + 1;
    if (totalWidth > termWidth) {
      const excess = totalWidth - termWidth;
      const capacities = widths.map((w, i) => {
        if (columns?.[i]?.fixed) {
          return 0;
        }
        return Math.max(0, w - headers[i].length);
      });
      const totalCapacity = capacities.reduce((s, c) => s + c, 0);

      let useCards = false;
      if (totalCapacity < excess) {
        useCards = true;
      } else {
        for (let i = 0; i < N; i++) {
          if (
            !columns?.[i]?.fixed &&
            capacities[i] > 0 &&
            widths[i] >= MIN_USEFUL_WIDTH
          ) {
            const share = Math.round((capacities[i] / totalCapacity) * excess);
            if (widths[i] - share < MIN_USEFUL_WIDTH) {
              useCards = true;
              break;
            }
          }
        }
      }

      if (useCards) {
        return renderCards(headers, rows);
      }

      const reduction = Math.min(excess, totalCapacity);
      for (let i = 0; i < N; i++) {
        if (capacities[i] > 0) {
          const share = Math.round((capacities[i] / totalCapacity) * reduction);
          widths[i] = widths[i] - share;
        }
      }
    }
  }

  const top =
    BOX.tl + widths.map((w) => BOX.h.repeat(w + 2)).join(BOX.tm) + BOX.tr;
  const mid =
    BOX.lm + widths.map((w) => BOX.h.repeat(w + 2)).join(BOX.mm) + BOX.rm;
  const bot =
    BOX.bl + widths.map((w) => BOX.h.repeat(w + 2)).join(BOX.bm) + BOX.br;
  const row = (cells: string[]) =>
    BOX.v +
    ' ' +
    cells
      .map((c, i) => {
        const display =
          c.length > widths[i]
            ? widths[i] >= 4
              ? `${c.slice(0, widths[i] - 3)}...`
              : c.slice(0, widths[i])
            : c;
        return display.padEnd(widths[i]);
      })
      .join(` ${BOX.v} `) +
    ' ' +
    BOX.v;
  return [top, row(headers), mid, ...rows.map(row), bot].join('\n');
}
