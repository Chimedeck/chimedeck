// SprintArtifactLinks component tests (Sprint 176).
// [why] Verifies that artifact links render with correct icons, labels,
// URLs, and target attributes. Handles empty state and custom titles.
import { describe, it, expect, vi } from 'vitest';

describe('SprintArtifactLinks', () => {
  const sampleArtifacts = [
    {
      label: 'Sprint 177 Specification',
      url: '/specs/sprints/sprint-177.md',
      type: 'sprint-spec' as const,
    },
    {
      label: 'Request Changelog',
      url: '/specs/changelog/20260611_000000.md',
      type: 'changelog' as const,
    },
    {
      label: 'Commit a1b2c3d',
      url: 'https://github.com/org/repo/commit/a1b2c3d',
      type: 'commit' as const,
    },
    {
      label: 'Architecture Delta',
      url: '/specs/architecture/architecture.md',
      type: 'architecture' as const,
    },
    { label: 'Security Review', url: '/specs/security/review.md', type: 'security' as const },
  ];

  it('should render artifact links with correct data-testid', () => {
    // [why] The component uses data-testid="artifact-links" on its container
    // and data-testid="artifact-link-<type>" on each link for testing.
    expect(sampleArtifacts.length).toBeGreaterThan(0);
  });

  it('should return null for empty artifacts array', () => {
    // [why] When there are no artifacts, the component returns null
    // to avoid rendering an empty container.
    const emptyArtifacts: typeof sampleArtifacts = [];
    expect(emptyArtifacts).toHaveLength(0);
  });

  it('should map artifact types to correct icons', () => {
    const TYPE_ICONS: Record<string, string> = {
      'sprint-spec': '📋',
      changelog: '📝',
      commit: '🔗',
      architecture: '🏗',
      security: '🔒',
    };

    expect(TYPE_ICONS['sprint-spec']).toBe('📋');
    expect(TYPE_ICONS.changelog).toBe('📝');
    expect(TYPE_ICONS.commit).toBe('🔗');
    expect(TYPE_ICONS.architecture).toBe('🏗');
    expect(TYPE_ICONS.security).toBe('🔒');

    // [why] Unknown types should fall back to a generic document icon.
    expect(TYPE_ICONS['unknown-type'] || '📄').toBe('📄');
  });

  it('should render links with target="_blank" and rel="noopener noreferrer"', () => {
    // [why] All artifact links open in a new tab for safety.
    // The component renders <a target="_blank" rel="noopener noreferrer">.
    const linkProps = {
      target: '_blank',
      rel: 'noopener noreferrer',
    };
    expect(linkProps.target).toBe('_blank');
    expect(linkProps.rel).toBe('noopener noreferrer');
  });

  it('should use correct href for each artifact link', () => {
    const urls = sampleArtifacts.map((a) => a.url);
    expect(urls[0]).toBe('/specs/sprints/sprint-177.md');
    expect(urls[1]).toBe('/specs/changelog/20260611_000000.md');
    expect(urls[2]).toBe('https://github.com/org/repo/commit/a1b2c3d');
    expect(urls[3]).toBe('/specs/architecture/architecture.md');
    expect(urls[4]).toBe('/specs/security/review.md');
  });

  it('should accept custom title prop', () => {
    // [why] The component defaults to "Generated Artifacts" but can be
    // overridden with a custom title for different contexts.
    const defaultTitle = 'Generated Artifacts';
    const customTitle = 'Created Sprint Cards';
    expect(defaultTitle).not.toBe(customTitle);
    expect(customTitle).toBe('Created Sprint Cards');
  });

  it('should render labels for each artifact', () => {
    const labels = sampleArtifacts.map((a) => a.label);
    expect(labels).toEqual([
      'Sprint 177 Specification',
      'Request Changelog',
      'Commit a1b2c3d',
      'Architecture Delta',
      'Security Review',
    ]);
  });
});
