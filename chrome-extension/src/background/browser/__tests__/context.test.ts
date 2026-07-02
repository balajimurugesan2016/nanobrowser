import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../services/analytics', () => ({
  analytics: {
    trackDomainVisit: vi.fn(),
  },
}));

import BrowserContext, { COMPUTER_USE_BOOTSTRAP_URL } from '../context';
import Page from '../page';

describe('BrowserContext.attachPage', () => {
  let context: BrowserContext;

  beforeEach(() => {
    context = new BrowserContext({});
  });

  it('re-attaches when tab is in map but puppeteer is disconnected', async () => {
    const page = new Page(1, 'https://example.com', 'Example');
    const attachSpy = vi.spyOn(page, 'attachPuppeteer').mockResolvedValue(true);

    expect(await context.attachPage(page)).toBe(true);
    expect(attachSpy).toHaveBeenCalledTimes(1);

    // Simulate stale map entry with disconnected puppeteer
    await page.detachPuppeteer();
    attachSpy.mockClear();
    attachSpy.mockResolvedValue(true);

    expect(await context.attachPage(page)).toBe(true);
    expect(attachSpy).toHaveBeenCalledTimes(1);
  });

  it('returns false for non-http tabs without attaching', async () => {
    const page = new Page(2, 'chrome://newtab', 'New Tab');
    const attachSpy = vi.spyOn(page, 'attachPuppeteer');

    expect(await context.attachPage(page)).toBe(false);
    expect(attachSpy).not.toHaveBeenCalled();
  });
});

describe('BrowserContext.ensureComputerUsePage', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      tabs: {
        update: vi.fn().mockResolvedValue({}),
        get: vi
          .fn()
          .mockResolvedValueOnce({ id: 5, url: 'chrome://newtab', title: 'New Tab', active: true })
          .mockResolvedValue({ id: 5, url: COMPUTER_USE_BOOTSTRAP_URL, title: 'Google', active: true }),
      },
    });
  });

  it('bootstraps invalid tabs to the starter https URL', async () => {
    const context = new BrowserContext({});
    const invalidPage = new Page(5, 'chrome://newtab', 'New Tab');
    const readyPage = {
      tabId: 5,
      validWebPage: true,
      attached: true,
      syncFromTab: vi.fn(),
    } as unknown as Page;

    const switchTabSpy = vi.spyOn(context, 'switchTab').mockResolvedValue(invalidPage);
    const navigateSpy = vi.spyOn(context, 'navigateTo').mockResolvedValue();
    vi.spyOn(context, 'getCurrentPage').mockResolvedValue(readyPage);
    vi.spyOn(context, 'attachPage').mockResolvedValue(true);

    const page = await context.ensureComputerUsePage(5);

    expect(switchTabSpy).toHaveBeenCalledWith(5);
    expect(navigateSpy).toHaveBeenCalledWith(COMPUTER_USE_BOOTSTRAP_URL);
    expect(page).toBe(readyPage);
  });
});
