export function parseCheckboxTarget(text: string): number | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized.includes('checkbox') && !/^\d+$/.test(normalized)) {
    return null;
  }

  if (normalized.includes('first')) {
    return 1;
  }

  const numberedMatch = normalized.match(/checkbox\s*#?(\d+)/);
  if (numberedMatch) {
    return Number.parseInt(numberedMatch[1], 10);
  }

  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return null;
}
