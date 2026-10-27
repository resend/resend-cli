import type { GlobalOpts } from '../../../lib/client';
import { outputError } from '../../../lib/output';
import { safeTerminalText } from '../../../lib/safe-terminal-text';

export function failWebhookTrigger(
  message: string,
  code: string,
  opts: GlobalOpts,
  extra: { statusCode?: number; body?: string } = {},
): never {
  outputError(
    { message: safeTerminalText(message), code, ...extra },
    { json: opts.json || opts.quiet },
  );
}
