import pc from 'picocolors';
import { TAGLINE, wordmark } from './brand';

const LOGO_LINES = [
  '+++++++++++++++++++++                                                                                                +++++',
  '+++++++++++++++++++++++                                                                                              +++++',
  '              ++++++++++                                                                                             +++++',
  '               +++++++++       +++++             +++++++              +++++                 ++++              +++    +++++',
  '               +++++++++   +++++++++++++      ++++++++++++++      +++++++++++++    ++++++++++++++++       ++++++++++++++++',
  '            +++++++++++   ++++++++++++++++   ++++++++++++++++   ++++++++++++++++   ++++++++++++++++++   ++++++++++++++++++',
  '      +++++++++++++++   +++++++     +++++++ +++++++     ++++++ ++++++      +++++++ +++++++    ++++++++ ++++++++    +++++++',
  '      +++++++++         +++++++++++++++++++  ++++++++++++++    +++++++++++++++++++ ++++++       ++++++ ++++++        +++++',
  '       ++++++++++       +++++++++++++++++++   +++++++++++++++  +++++++++++++++++++ ++++++       +++++++++++++        +++++',
  '         ++++++++++     ++++++                    ++++++++++++ ++++++              ++++++       ++++++ ++++++       ++++++',
  '           +++++++++++   +++++++    +++++++ +++++++     ++++++  +++++++    +++++++ ++++++       ++++++ ++++++++   ++++++++',
  '             ++++++++++   ++++++++++++++++   ++++++++++++++++    +++++++++++++++   ++++++       ++++++  ++++++++++++++++++',
  '               ++++++++++   +++++++++++         +++++++++++        +++++++++++     ++++++       ++++++     +++++++++ +++++',
];

// The icon mark — a compact variation of the full wordmark for narrower terminals.
const ICON_LINES = [
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '                  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '                     ▓▓▓▓▓▓▓▓▓▓▓▓',
  '                     ▓▓▓▓▓▓▓▓▓▓▓▓',
  '                     ▓▓▓▓▓▓▓▓▓▓▓▓',
  '                    ▓▓▓▓▓▓▓▓▓▓▓▓',
  '               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '        ▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '         ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '             ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '                 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '                   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
  '                     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
];

function maxLineWidth(lines: string[]): number {
  return Math.max(...lines.map((l) => l.length));
}

const LOGO_WIDTH = maxLineWidth(LOGO_LINES);
const ICON_WIDTH = maxLineWidth(ICON_LINES);

// Picks the widest logo that still fits the terminal — full wordmark art,
// the icon mark (narrower still), or plain text.
function selectLogoLines(): string[] | null {
  const width = process.stdout.columns;
  if (width === undefined || width >= LOGO_WIDTH) {
    return LOGO_LINES;
  }
  if (width >= ICON_WIDTH) {
    return ICON_LINES;
  }
  return null;
}

export function printBanner(): void {
  process.stdout.write('\n');
  const lines = selectLogoLines();
  if (lines) {
    for (const line of lines) {
      process.stdout.write(`${pc.bold(line)}\n`);
    }
  } else {
    process.stdout.write(`  ${wordmark()}\n`);
  }
  process.stdout.write(`  ${pc.dim(TAGLINE)}\n`);
  process.stdout.write('\n');
}
