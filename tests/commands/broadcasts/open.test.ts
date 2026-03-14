import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as browser from '../../../src/lib/browser';

describe('broadcasts open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowser').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('with no args opens broadcasts list', async () => {
    const { openBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/open'
    );
    await openBroadcastCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowser).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowser).toHaveBeenCalledWith(
      browser.RESEND_URLS.broadcasts,
    );
  });

  test('with id opens broadcast URL', async () => {
    const { openBroadcastCommand } = await import(
      '../../../src/commands/broadcasts/open'
    );
    await openBroadcastCommand.parseAsync(
      ['d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'],
      { from: 'user' },
    );

    expect(browser.openInBrowser).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowser).toHaveBeenCalledWith(
      browser.RESEND_URLS.broadcast('d1c2b3a4-5e6f-7a8b-9c0d-e1f2a3b4c5d6'),
    );
  });
});
