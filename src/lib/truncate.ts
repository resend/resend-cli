const ELLIPSIS = '...';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Shorten `value` to at most `max` UTF-16 code units, ending in "..." when it
 * is cut. Cuts on whole visible characters (graphemes), so emoji built from
 * several characters (families, flags, skin tones) are kept or dropped whole
 * instead of leaving a stray joiner, half a flag or a lone surrogate.
 *
 * When `max` is not larger than the ellipsis there is no room for it, so the
 * value is hard-cut with `slice(0, max)`.
 */
export function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  if (max <= ELLIPSIS.length) {
    return value.slice(0, max);
  }
  const budget = max - ELLIPSIS.length;
  let end = 0;
  for (const { segment } of segmenter.segment(value)) {
    if (end + segment.length > budget) {
      break;
    }
    end += segment.length;
  }
  return `${value.slice(0, end)}${ELLIPSIS}`;
}
