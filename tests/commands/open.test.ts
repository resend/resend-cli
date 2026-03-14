import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as browser from '../../src/lib/browser';

describe('resend open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowser').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('opens emails URL in browser', async () => {
    const { openCommand } = await import('../../src/commands/open');
    await openCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowser).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowser).toHaveBeenCalledWith(
      browser.DASHBOARD_URLS.emails,
    );
  });
});
