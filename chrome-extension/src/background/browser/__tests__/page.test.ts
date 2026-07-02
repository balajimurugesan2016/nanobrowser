import { describe, it, expect, vi } from 'vitest';

vi.mock('webextension-polyfill', () => ({}));

vi.mock('puppeteer-core/lib/esm/puppeteer/puppeteer-core-browser.js', () => ({
  connect: vi.fn(),
  ExtensionTransport: { connectTab: vi.fn() },
}));

vi.mock('../dom/service', () => ({
  getClickableElements: vi.fn(),
  removeHighlights: vi.fn(),
  getScrollInfo: vi.fn(),
}));

import Page, { isValidWebPageUrl } from '../page';

describe('isValidWebPageUrl', () => {
  it('accepts https pages', () => {
    expect(isValidWebPageUrl(1, 'https://amazon.de')).toBe(true);
  });

  it('rejects chrome:// and blank pages', () => {
    expect(isValidWebPageUrl(1, 'chrome://newtab')).toBe(false);
    expect(isValidWebPageUrl(1, 'about:blank')).toBe(false);
  });

  it('rejects chromewebstore', () => {
    expect(isValidWebPageUrl(1, 'https://chromewebstore.google.com/detail/foo')).toBe(false);
  });
});

describe('Page.syncFromTab', () => {
  it('updates validWebPage when tab navigates to https', () => {
    const page = new Page(42, 'chrome://newtab', 'New Tab');
    expect(page.validWebPage).toBe(false);

    page.syncFromTab({
      id: 42,
      url: 'https://amazon.de',
      title: 'Amazon.de',
    } as chrome.tabs.Tab);

    expect(page.validWebPage).toBe(true);
    expect(page.url()).toBe('https://amazon.de');
  });
});
