import type BrowserContext from '../../browser/context';
import { COMPUTER_USE_BOOTSTRAP_URL } from '../../browser/context';
import { isUrlAllowed } from '../../browser/util';
import { extractFirstHttpUrlFromTask, urlsRoughlyMatch } from './taskUrl';

export async function prepareComputerUseTab(
  browserContext: BrowserContext,
  tabId: number,
  task: string,
): Promise<void> {
  const taskUrl = extractFirstHttpUrlFromTask(task);
  const config = browserContext.getConfig();
  const allowedTaskUrl = taskUrl && isUrlAllowed(taskUrl, config.allowedUrls, config.deniedUrls) ? taskUrl : null;
  const bootstrapUrl = allowedTaskUrl ?? COMPUTER_USE_BOOTSTRAP_URL;

  let page = await browserContext.ensureComputerUsePage(tabId, { bootstrapUrl });

  if (allowedTaskUrl && !urlsRoughlyMatch(page.url(), allowedTaskUrl)) {
    await browserContext.navigateTo(allowedTaskUrl);
    page = await browserContext.getCurrentPage();
  }

  if (!page.attached) {
    await browserContext.attachPage(page);
    page = await browserContext.getCurrentPage();
  }

  if (page.attached) {
    try {
      await page.waitForPageAndFramesLoad();
    } catch {
      // Best-effort settle before the first computer-use screenshot.
    }
  }
}
