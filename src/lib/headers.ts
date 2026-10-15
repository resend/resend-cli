import type { GlobalOpts } from './client';
import { outputError } from './output';

export function parseHeaderPairs(
  values: string[] | undefined,
  globalOpts: GlobalOpts,
): Record<string, string> | undefined {
  if (!values) {
    return undefined;
  }
  return Object.fromEntries(
    values.map((pair) => {
      const eq = pair.indexOf('=');
      if (eq < 1) {
        outputError(
          {
            message: `Invalid header format: "${pair}". Expected key=value.`,
            code: 'invalid_header',
          },
          { json: globalOpts.json },
        );
      }
      return [pair.slice(0, eq), pair.slice(eq + 1)];
    }),
  );
}
