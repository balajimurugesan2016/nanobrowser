import { describe, expect, it } from 'vitest';
import { shouldEmitCapturePageForComputerUse } from '../computerActionLabels';

describe('shouldEmitCapturePageForComputerUse', () => {
  it('emits capture UI for screenshot-only tool batches', () => {
    expect(shouldEmitCapturePageForComputerUse(0)).toBe(true);
  });

  it('uses batch UI when display actions exist', () => {
    expect(shouldEmitCapturePageForComputerUse(1)).toBe(false);
    expect(shouldEmitCapturePageForComputerUse(3)).toBe(false);
  });
});
