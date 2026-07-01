import pc from 'picocolors';
import { safeTerminalText } from './safe-terminal-text';
import { isUnicodeSupported } from './tty';

export type StatusTone = 'success' | 'pending' | 'failure' | 'neutral';

export interface RenderTableOptions {
  // Colors the cell at `index` for each row per `tones[rowIndex]` (undefined = no color).
  statusColumn?: {
    index: number;
    tones: (StatusTone | undefined)[];
  };
}

const TONE_COLOR: Record<StatusTone, (s: string) => string> = {
  success: pc.green,
  pending: pc.yellow,
  failure: pc.red,
  neutral: pc.dim,
};

function colorizeStatusCell(
  cell: string,
  rowIndex: number,
  colIndex: number,
  statusColumn: RenderTableOptions['statusColumn'],
): string {
  if (!statusColumn || colIndex !== statusColumn.index) {
    return cell;
  }
  const tone = statusColumn.tones[rowIndex];
  return tone ? TONE_COLOR[tone](cell) : cell;
}

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

function getTerminalWidth(): number | undefined {
  return process.stdout.columns;
}

function renderCards(
  headers: string[],
  rows: string[][],
  termWidth: number,
  statusColumn: RenderTableOptions['statusColumn'],
): string {
  const labelWidth = Math.max(...headers.map((h) => h.length));
  const sepWidth = Math.max(20, Math.min(termWidth, 60));

  return rows
    .map((row, idx) => {
      const label = String(idx + 1);
      const sep = pc.dim(
        `${BOX.h}${BOX.h} ${label} ${BOX.h.repeat(Math.max(0, sepWidth - label.length - 4))}`,
      );
      const fields = headers.map((h, i) => {
        const value = colorizeStatusCell(row[i], idx, i, statusColumn);
        return `  ${h.padEnd(labelWidth)}  ${value}`;
      });
      return [sep, ...fields].join('\n');
    })
    .join('\n\n');
}

export function renderTable(
  headers: string[],
  rows: string[][],
  emptyMessage = '(no results)',
  options: RenderTableOptions = {},
): string {
  if (rows.length === 0) {
    return emptyMessage;
  }
  const sanitizedRows = rows.map((r) => r.map(safeTerminalText));
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...sanitizedRows.map((r) => r[i].length)),
  );

  const termWidth = getTerminalWidth();
  if (termWidth !== undefined) {
    const totalWidth =
      widths.reduce((s, w) => s + w, 0) + 3 * widths.length + 1;
    if (totalWidth > termWidth) {
      return renderCards(
        headers,
        sanitizedRows,
        termWidth,
        options.statusColumn,
      );
    }
  }

  const top = pc.dim(
    BOX.tl + widths.map((w) => BOX.h.repeat(w + 2)).join(BOX.tm) + BOX.tr,
  );
  const mid = pc.dim(
    BOX.lm + widths.map((w) => BOX.h.repeat(w + 2)).join(BOX.mm) + BOX.rm,
  );
  const bot = pc.dim(
    BOX.bl + widths.map((w) => BOX.h.repeat(w + 2)).join(BOX.bm) + BOX.br,
  );
  const row = (cells: string[], rowIndex?: number) =>
    BOX.v +
    ' ' +
    cells
      .map((c, i) => {
        const padded = c.padEnd(widths[i]);
        return rowIndex === undefined
          ? padded
          : colorizeStatusCell(padded, rowIndex, i, options.statusColumn);
      })
      .join(` ${BOX.v} `) +
    ' ' +
    BOX.v;
  return [
    top,
    pc.bold(row(headers)),
    mid,
    ...sanitizedRows.map((r, idx) => row(r, idx)),
    bot,
  ].join('\n');
}
