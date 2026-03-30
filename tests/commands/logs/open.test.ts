import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as browser from '../../../src/lib/browser';

describe('logs open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowserOrLog').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('with no args opens logs list', async () => {
    const { openLogsCommand } = await import('../../../src/commands/logs/open');
    await openLogsCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.logs,
      expect.any(Object),
    );
  });

  test('with id opens log detail URL', async () => {
    const { openLogsCommand } = await import('../../../src/commands/logs/open');
    await openLogsCommand.parseAsync(['3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55'], {
      from: 'user',
    });

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.log('3d4a472d-bc6d-4dd2-aa9d-d3d11b549e55'),
      expect.any(Object),
    );
  });
});
