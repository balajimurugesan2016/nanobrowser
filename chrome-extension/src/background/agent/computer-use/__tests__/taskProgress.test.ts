import { describe, expect, it } from 'vitest';
import { evaluateNumberedTaskProgress } from '../taskProgress';

const task = `1. Open https://the-internet.herokuapp.com/
2. Screenshot
3. Click "Checkboxes"
4. Screenshot
5. Click the first checkbox
6. Screenshot`;

describe('evaluateNumberedTaskProgress', () => {
  it('marks the numbered checkbox flow complete when evidence matches', () => {
    const result = evaluateNumberedTaskProgress(
      task,
      'https://the-internet.herokuapp.com/checkboxes',
      { screenshotCount: 3, recentActions: ['left_click checkbox 1'] },
      [
        { index: 1, checked: true },
        { index: 2, checked: false },
      ],
    );

    expect(result.likelyComplete).toBe(true);
    expect(result.summaryLines.some(line => line.includes('done=true'))).toBe(true);
  });

  it('stays incomplete when the first checkbox is still unchecked', () => {
    const result = evaluateNumberedTaskProgress(
      task,
      'https://the-internet.herokuapp.com/checkboxes',
      { screenshotCount: 2, recentActions: [] },
      [
        { index: 1, checked: false },
        { index: 2, checked: true },
      ],
    );

    expect(result.likelyComplete).toBe(false);
  });
});
