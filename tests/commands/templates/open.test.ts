import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as browser from '../../../src/lib/browser';

describe('templates open command', () => {
  beforeEach(() => {
    vi.spyOn(browser, 'openInBrowser').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('with no args opens templates list', async () => {
    const { openTemplateCommand } = await import(
      '../../../src/commands/templates/open'
    );
    await openTemplateCommand.parseAsync([], { from: 'user' });

    expect(browser.openInBrowser).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowser).toHaveBeenCalledWith(
      browser.RESEND_URLS.templates,
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

    expect(browser.openInBrowser).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowser).toHaveBeenCalledWith(
      browser.RESEND_URLS.template('78261eea-8f8b-4381-83c6-79fa7120f1cf'),
    );
  });

  test('with alias opens template URL', async () => {
    const { openTemplateCommand } = await import(
      '../../../src/commands/templates/open'
    );
    await openTemplateCommand.parseAsync(['my-template-alias'], {
      from: 'user',
    });

    expect(browser.openInBrowser).toHaveBeenCalledTimes(1);
    expect(browser.openInBrowser).toHaveBeenCalledWith(
      browser.RESEND_URLS.template('my-template-alias'),
    );
  });
});
