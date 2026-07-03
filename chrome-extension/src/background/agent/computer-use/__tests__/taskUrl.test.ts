import { describe, expect, it } from 'vitest';
import { extractFirstHttpUrlFromTask, extractQuotedTargetTexts, isResearchTask, urlsRoughlyMatch } from '../taskUrl';

describe('extractFirstHttpUrlFromTask', () => {
  it('extracts the first https URL from a task', () => {
    expect(extractFirstHttpUrlFromTask('Go to https://the-internet.herokuapp.com/ and take a screenshot.')).toBe(
      'https://the-internet.herokuapp.com/',
    );
  });

  it('strips trailing punctuation from extracted URLs', () => {
    expect(extractFirstHttpUrlFromTask('Visit https://example.com.')).toBe('https://example.com');
  });

  it('extracts quoted link labels but not URLs', () => {
    expect(extractQuotedTargetTexts('On https://example.com/, click "Form Authentication", then screenshot.')).toEqual([
      'Form Authentication',
    ]);
  });
});

describe('urlsRoughlyMatch', () => {
  it('matches same origin and path with optional trailing slash', () => {
    expect(urlsRoughlyMatch('https://example.com/foo/', 'https://example.com/foo')).toBe(true);
  });

  it('does not match different hosts', () => {
    expect(urlsRoughlyMatch('https://www.google.com/', 'https://the-internet.herokuapp.com/')).toBe(false);
  });
});

describe('isResearchTask', () => {
  it('detects summarize and find-everything tasks', () => {
    expect(isResearchTask('On this page, find everything about Dipole antennas and summarize it with sources')).toBe(
      true,
    );
    expect(isResearchTask('Go to example.com and click login')).toBe(false);
  });
});
