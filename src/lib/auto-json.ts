/**
 * Returns true when the CLI should automatically enable JSON output.
 * Called from the preAction hook in cli.ts.
 */
export function shouldAutoEnableJson(json?: unknown): boolean {
  if (json) {
    return false;
  }
  return (
    !process.stdout.isTTY ||
    process.env.CI === 'true' ||
    process.env.CI === '1' ||
    !!process.env.GITHUB_ACTIONS ||
    process.env.TERM === 'dumb'
  );
}
