import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as browser from '../../../src/lib/browser';

describe('logs open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowserOrLog').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('opens logs dashboard URL', async () => {
    const { openLogsCommand } = await import('../../../src/commands/logs/open');
    await openLogsCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.logs,
      expect.any(Object),
    );
  });
});
