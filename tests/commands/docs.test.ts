import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as browser from '../../src/lib/browser';

describe('resend docs command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowserOrLog').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens documentation URL in browser', async () => {
    const { docsCommand } = await import('../../src/commands/docs');

    await docsCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.documentation,
      expect.any(Object),
    );
  });
});
