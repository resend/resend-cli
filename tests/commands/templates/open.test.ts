import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTemplateCommand } from '../../../src/commands/templates/open';
import * as browser from '../../../src/lib/browser';
import {
  captureTestEnv,
  expectExit1,
  mockExitThrow,
  setNonInteractive,
  setupOutputSpies,
} from '../../helpers';

const templateId = '78261eea-8f8b-4381-83c6-79fa7120f1cf';

const mockGet = vi.fn(async (_id: string) => ({
  data: { object: 'template' as const, id: templateId },
  error: null as { message: string } | null,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    constructor(public key: string) {}
    templates = { get: mockGet };
  },
}));

describe('templates open command', () => {
  const restoreEnv = captureTestEnv();

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key';
    vi.spyOn(browser, 'openInBrowserOrLog').mockResolvedValue();
    mockGet.mockClear();
  });

  afterEach(() => {
    restoreEnv();
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

  it('with id opens template URL without an API call', async () => {
    await openTemplateCommand.parseAsync([templateId], { from: 'user' });

    expect(mockGet).not.toHaveBeenCalled();
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.template(templateId),
      expect.any(Object),
    );
  });

  it('with alias opens the URL of the template it resolves to', async () => {
    await openTemplateCommand.parseAsync(['welcome-email'], { from: 'user' });

    expect(mockGet).toHaveBeenCalledWith('welcome-email');
    expect(browser.openInBrowserOrLog).toHaveBeenCalledWith(
      browser.RESEND_URLS.template(templateId),
      expect.any(Object),
    );
  });

  it('with unknown alias exits without opening the browser', async () => {
    setNonInteractive();
    setupOutputSpies();
    mockExitThrow();
    mockGet.mockResolvedValueOnce({
      data: null as never,
      error: { message: 'Template not found' },
    });

    await expectExit1(() =>
      openTemplateCommand.parseAsync(['missing-alias'], { from: 'user' }),
    );
    expect(browser.openInBrowserOrLog).not.toHaveBeenCalled();
  });
});
