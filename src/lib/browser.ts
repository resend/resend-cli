import { execFile } from 'node:child_process';
import pc from 'picocolors';

const RESEND_BASE = 'https://resend.com';

export const openInBrowser = (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    const cmd =
      process.platform === 'win32'
        ? 'explorer.exe'
        : process.platform === 'darwin'
          ? 'open'
          : 'xdg-open';
    execFile(cmd, [url], { timeout: 5000 }, (err) => resolve(!err));
  });

export type OpenInBrowserOrLogOpts = {
  json?: boolean;
  quiet?: boolean;
};

export const openInBrowserOrLog = async (
  url: string,
  opts?: OpenInBrowserOrLogOpts,
): Promise<void> => {
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
};

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
