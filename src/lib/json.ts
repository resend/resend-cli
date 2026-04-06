import { outputError } from './output';

export function parseJsonFlag(
  raw: string | undefined,
  flagName: string,
  globalOpts: { json?: boolean },
): unknown | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    outputError(
      {
        message: `Invalid JSON for ${flagName}.`,
        code: 'invalid_json',
      },
      { json: globalOpts.json },
    );
  }
}
