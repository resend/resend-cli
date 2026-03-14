import { spawn } from 'node:child_process';

const RESEND_BASE = 'https://resend.com';

/**
 * Open a URL in the user's default browser. Fires and forgets; does not block.
 */
export function openInBrowser(url: string): void {
  const { platform } = process;
  const args =
    platform === 'darwin'
      ? ['open', url]
      : platform === 'win32'
        ? ['cmd', '/c', 'start', url]
        : ['xdg-open', url];

  spawn(args[0], args.slice(1), { stdio: 'ignore', detached: true })
    .on('error', () => {})
    .unref();
}

export const DASHBOARD_URLS = {
  emails: `${RESEND_BASE}/emails`,
  templates: `${RESEND_BASE}/templates`,
  template: (id: string) => `${RESEND_BASE}/templates/${id}`,
  broadcasts: `${RESEND_BASE}/broadcasts`,
  broadcast: (id: string) => `${RESEND_BASE}/broadcasts/${id}/editor`,
} as const;
