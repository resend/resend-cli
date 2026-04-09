import { execFile } from 'node:child_process';
import pc from 'picocolors';

const RESEND_BASE = 'https://resend.com';

/**
 * Try to open a URL in the user's default browser. Returns true if the open
 * succeeded, false on error or when the terminal has no browser (e.g. SSH).
 */
export function openInBrowser(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd =
      process.platform === 'win32'
        ? 'cmd.exe'
        : process.platform === 'darwin'
          ? 'open'
          : 'xdg-open';
    const safeUrl = url.replaceAll('"', '');
    const args =
      process.platform === 'win32'
        ? ['/c', 'start', '""', `"${safeUrl}"`]
        : [url];
    execFile(
      cmd,
      args,
      { timeout: 5000, windowsVerbatimArguments: true },
      (err) => resolve(!err),
    );
  });
}

export type OpenInBrowserOrLogOpts = {
  json?: boolean;
  quiet?: boolean;
};

/**
 * Opens the URL in the browser and logs the outcome: success with link, or
 * warning with link to copy when the browser could not be opened. No output
 * when opts.json or opts.quiet.
 */
export async function openInBrowserOrLog(
  url: string,
  opts?: OpenInBrowserOrLogOpts,
): Promise<void> {
  const opened = await openInBrowser(url);
  if (opts?.json || opts?.quiet) {
    return;
  }
  if (opened) {
    console.log(pc.dim('Opened'), pc.blue(url));
  } else {
    console.warn(
      pc.yellow('Could not open browser. Visit this link:'),
      pc.blue(url),
    );
  }
}

export const RESEND_URLS = {
  emails: `${RESEND_BASE}/emails`,
  logs: `${RESEND_BASE}/logs`,
  log: (id: string) => `${RESEND_BASE}/logs/${id}`,
  templates: `${RESEND_BASE}/templates`,
  template: (id: string) => `${RESEND_BASE}/templates/${id}`,
  broadcasts: `${RESEND_BASE}/broadcasts`,
  broadcast: (id: string) => `${RESEND_BASE}/broadcasts/${id}`,
  documentation: `${RESEND_BASE}/docs`,
} as const;
