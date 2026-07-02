const TASK_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/i;

/** Strip trailing punctuation often copied with URLs in natural-language tasks. */
function trimUrlSuffix(url: string): string {
  return url.replace(/[.,;:!?)]+$/, '');
}

export function extractFirstHttpUrlFromTask(task: string): string | null {
  const match = task.match(TASK_URL_PATTERN);
  if (!match) {
    return null;
  }
  return trimUrlSuffix(match[0]);
}

export function urlsRoughlyMatch(current: string, target: string): boolean {
  try {
    const currentUrl = new URL(current);
    const targetUrl = new URL(target);
    const normalizePath = (path: string) => path.replace(/\/$/, '') || '/';
    return (
      currentUrl.origin === targetUrl.origin && normalizePath(currentUrl.pathname) === normalizePath(targetUrl.pathname)
    );
  } catch {
    return false;
  }
}

const QUOTED_TEXT_PATTERN = /"([^"]+)"|'([^']+)'/g;

export function extractQuotedTargetTexts(task: string): string[] {
  const results: string[] = [];

  for (const match of task.matchAll(QUOTED_TEXT_PATTERN)) {
    const text = (match[1] ?? match[2])?.trim();
    if (!text || extractFirstHttpUrlFromTask(text)) {
      continue;
    }
    results.push(text);
  }

  return results;
}
