export function buildComputerActionFeedback(note: string | undefined, pageUrl: string, pageTitle: string): string {
  const lines = [note, `Current page: ${pageUrl}`, `Title: ${pageTitle}`].filter((line): line is string =>
    Boolean(line),
  );
  return lines.join('\n');
}
