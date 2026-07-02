import { describe, it, expect } from 'vitest';
import { convertBrowserKeyToken } from '../computerKeys';

describe('convertBrowserKeyToken', () => {
  it('maps Anthropic page keys', () => {
    expect(convertBrowserKeyToken('Page_Down')).toBe('PageDown');
    expect(convertBrowserKeyToken('Page_Up')).toBe('PageUp');
  });

  it('maps arrow aliases used in combos', () => {
    expect(convertBrowserKeyToken('Left')).toBe('ArrowLeft');
    expect(convertBrowserKeyToken('alt')).toBe('Alt');
  });

  it('maps return to enter', () => {
    expect(convertBrowserKeyToken('Return')).toBe('Enter');
  });

  it('maps punctuation keys used in browser zoom shortcuts', () => {
    expect(convertBrowserKeyToken('minus')).toBe('Minus');
    expect(convertBrowserKeyToken('equal')).toBe('Equal');
    expect(convertBrowserKeyToken('+')).toBe('Plus');
  });
});
