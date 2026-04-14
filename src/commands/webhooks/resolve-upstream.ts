export type ForwardResult =
  | { readonly status: number }
  | { readonly error: string; readonly timeout?: boolean };

export function resolveUpstream(result: ForwardResult | undefined): {
  readonly status: number;
  readonly body: string;
} {
  if (!result) {
    return { status: 200, body: 'OK' };
  }
  if ('error' in result) {
    return result.timeout
      ? { status: 504, body: 'Forward target timed out' }
      : { status: 502, body: 'Forward target unreachable' };
  }
  return result.status >= 200 && result.status < 300
    ? { status: 200, body: 'OK' }
    : { status: result.status, body: 'Forward target failed' };
}
