// Number() over parseFloat: parseFloat silently truncates at the first invalid
// character ("1,000" -> 1). Infinity is rejected because JSON serializes it as
// null, and blank input because Number(" ") is 0.
export function parseFiniteNumber(raw: string): number | undefined {
  if (raw.trim() === '') {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}
