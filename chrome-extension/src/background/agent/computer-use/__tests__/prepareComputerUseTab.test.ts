import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('webextension-polyfill', () => ({}));

vi.mock('@extension/i18n', () => ({
  t: (key: string) => key,
}));

vi.mock('@src/background/log', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import type BrowserContext from '../../../browser/context';
import { prepareComputerUseTab } from '../prepareComputerUseTab';

describe('prepareComputerUseTab', () => {
  let browserContext: BrowserContext;

  beforeEach(() => {
    browserContext = {
      getConfig: () => ({ allowedUrls: [], deniedUrls: [] }),
      ensureComputerUsePage: vi.fn().mockResolvedValue({
        url: () => 'https://www.google.com/',
        attached: true,
        waitForPageAndFramesLoad: vi.fn().mockResolvedValue(undefined),
      }),
      navigateTo: vi.fn().mockResolvedValue(undefined),
      getCurrentPage: vi.fn().mockResolvedValue({
        url: () => 'https://the-internet.herokuapp.com/',
        attached: true,
        waitForPageAndFramesLoad: vi.fn().mockResolvedValue(undefined),
      }),
      attachPage: vi.fn().mockResolvedValue(true),
    } as unknown as BrowserContext;
  });

  it('bootstraps to the task URL instead of Google when the task names a URL', async () => {
    await prepareComputerUseTab(browserContext, 5, 'Go to https://the-internet.herokuapp.com/ and take a screenshot.');

    expect(browserContext.ensureComputerUsePage).toHaveBeenCalledWith(5, {
      bootstrapUrl: 'https://the-internet.herokuapp.com/',
    });
    expect(browserContext.navigateTo).toHaveBeenCalledWith('https://the-internet.herokuapp.com/');
  });

  it('skips navigation when the tab is already on the task URL', async () => {
    vi.mocked(browserContext.ensureComputerUsePage).mockResolvedValue({
      url: () => 'https://the-internet.herokuapp.com/',
      attached: true,
      waitForPageAndFramesLoad: vi.fn().mockResolvedValue(undefined),
    } as never);

    await prepareComputerUseTab(browserContext, 5, 'Go to https://the-internet.herokuapp.com/ and take a screenshot.');

    expect(browserContext.navigateTo).not.toHaveBeenCalled();
  });
});
