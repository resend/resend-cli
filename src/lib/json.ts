import { outputError } from './output';

export function parseJsonFlag(
  raw: string | undefined,
  flagName: string,
  globalOpts: { json?: boolean },
): unknown | undefined {
  if (raw === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    outputError(
      {
        message: `Invalid JSON for ${flagName}: ${err instanceof Error ? err.message : 'parse error'}`,
        code: 'invalid_json',
      },
      { json: globalOpts.json },
    );
  }
}
