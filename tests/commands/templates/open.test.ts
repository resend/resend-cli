import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as browser from '../../../src/lib/browser';

describe('templates open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowserOrLog').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('with no args opens templates list', async () => {
    const { openTemplateCommand } = await import(
      '../../../src/commands/templates/open'
    );
    await openTemplateCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowserOrLog).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.templates,
      expect.any(Object),
    );
  });

  test('with id opens template URL', async () => {
    const { openTemplateCommand } = await import(
      '../../../src/commands/templates/open'
    );
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
