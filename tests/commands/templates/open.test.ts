import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTemplateCommand } from '../../../src/commands/templates/open';
import * as browser from '../../../src/lib/browser';

describe('templates open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowserOrLog').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('with no args opens templates list', async () => {
    await openTemplateCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.templates,
      expect.any(Object),
    );
  });

  it('with id opens template URL', async () => {
    await openTemplateCommand.parseAsync(
      ['78261eea-8f8b-4381-83c6-79fa7120f1cf'],
      { from: 'user' },
    );

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.template('78261eea-8f8b-4381-83c6-79fa7120f1cf'),
      expect.any(Object),
    );
  });
});
