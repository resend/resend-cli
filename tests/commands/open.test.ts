import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as browser from '../../src/lib/browser';

describe('resend open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowserOrLog').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('opens emails URL in browser', async () => {
    const { openCommand } = await import('../../src/commands/open');
    await openCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.emails,
      expect.any(Object),
    );
  });
});
