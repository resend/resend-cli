import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openCommand } from '../../src/commands/open';
import * as browser from '../../src/lib/browser';

describe('resend open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowserOrLog').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens emails URL in browser', async () => {
    await openCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.emails,
      expect.any(Object),
    );
  });
});
