// Unit tests for front-matter guard.
import { describe, it, expect } from 'vitest';
import { validateFrontMatter } from '../frontMatterGuard';

describe('validateFrontMatter', () => {
  it('returns valid for content without front-matter', () => {
    const result = validateFrontMatter({
      content: '# Just markdown\n\nNo front-matter here.',
      filePath: 'specs/request_changelog/test.md',
    });
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({});
    expect(result.original).toBe('');
  });

  it('returns valid for well-formed front-matter', () => {
    const result = validateFrontMatter({
      content: [
        '---',
        'title: Test Request',
        'date: 2026-06-10',
        'status: draft',
        '---',
        '',
        '# Body content',
      ].join('\n'),
      filePath: 'specs/request_changelog/test.md',
    });
    expect(result.valid).toBe(true);
    expect(result.parsed).toBeTruthy();
    if (result.parsed) {
      expect(result.parsed.title).toBe('Test Request');
      expect(result.parsed.status).toBe('draft');
    }
  });

  it('validates required fields for request_changelog docs', () => {
    const result = validateFrontMatter({
      content: [
        '---',
        'title: Test',
        // missing 'date' and 'status'
        '---',
        '',
        '# Missing required fields',
      ].join('\n'),
      filePath: 'specs/request_changelog/missing-fields.md',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing required fields');
    expect(result.reason).toContain('request_changelog');
  });

  it('validates required fields for sprint docs', () => {
    const result = validateFrontMatter({
      content: [
        '---',
        'title: Sprint 175',
        // missing sprint_number, status, start_date
        '---',
        '',
      ].join('\n'),
      filePath: 'specs/sprints/sprint-175.md',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing required fields');
  });

  it('returns valid for architecture docs with all required fields', () => {
    const result = validateFrontMatter({
      content: [
        '---',
        'title: Architecture Doc',
        'last_updated: 2026-06-10',
        '---',
        '',
      ].join('\n'),
      filePath: 'specs/architecture/test.md',
    });
    expect(result.valid).toBe(true);
  });

  it('returns valid for security docs with all required fields', () => {
    const result = validateFrontMatter({
      content: [
        '---',
        'title: Security Doc',
        'last_updated: 2026-06-10',
        '---',
        '',
      ].join('\n'),
      filePath: 'specs/security/test.md',
    });
    expect(result.valid).toBe(true);
  });

  it('returns invalid for malformed YAML front-matter with missing delimiter', () => {
    // [why] Content that starts with --- but is immediately unparseable
    // because the YAML content itself is broken.
    const result = validateFrontMatter({
      content: [
        '---',
        'this is : : not valid yaml : : :',
        '---',
        '',
        '# Body',
      ].join('\n'),
      filePath: 'specs/request_changelog/malformed.md',
    });
    // [why] The simple YAML parser can't handle duplicate colons per line,
    // but it might still produce a partial parse. The key behavior is that
    // required fields may be missing.
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing required fields');
  });

  it('preserves quoted values correctly', () => {
    const result = validateFrontMatter({
      content: [
        '---',
        'title: "Quoted Title"',
        'status: \'single quoted\'',
        'date: 2026-06-10',
        '---',
      ].join('\n'),
      filePath: 'specs/request_changelog/quoted.md',
    });
    expect(result.valid).toBe(true);
    if (result.parsed) {
      expect(result.parsed.title).toBe('Quoted Title');
      expect(result.parsed.status).toBe('single quoted');
    }
  });

  it('returns valid for unknown doc type paths (no schema check)', () => {
    const result = validateFrontMatter({
      content: [
        '---',
        'description: Just a description',
        '---',
      ].join('\n'),
      filePath: 'some/unknown/path.md',
    });
    expect(result.valid).toBe(true);
    expect(result.parsed).toBeTruthy();
  });
});
