import { describe, expect, it } from 'vitest';
import { buildComputerActionFeedback } from '../actionFeedback';

describe('buildComputerActionFeedback', () => {
  it('includes action note, url, and title', () => {
    expect(
      buildComputerActionFeedback(
        'Clicked "Form Authentication". Navigated to https://example.com/login (Login)',
        'https://example.com/login',
        'Login',
      ),
    ).toContain('Clicked "Form Authentication"');
    expect(buildComputerActionFeedback(undefined, 'https://example.com/', 'Home')).toBe(
      'Current page: https://example.com/\nTitle: Home',
    );
  });
});
