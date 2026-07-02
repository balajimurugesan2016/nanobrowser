import { describe, expect, it } from 'vitest';
import { parseCheckboxTarget } from '../clickTargets';

describe('parseCheckboxTarget', () => {
  it('parses first checkbox labels', () => {
    expect(parseCheckboxTarget('first checkbox')).toBe(1);
    expect(parseCheckboxTarget('checkbox 1')).toBe(1);
  });

  it('parses numbered checkbox labels', () => {
    expect(parseCheckboxTarget('checkbox 2')).toBe(2);
    expect(parseCheckboxTarget('2')).toBe(2);
  });

  it('returns null for non-checkbox labels', () => {
    expect(parseCheckboxTarget('Form Authentication')).toBeNull();
  });
});
