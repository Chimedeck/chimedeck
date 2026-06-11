// SprintArtifactLinks — links from card to generated sprint docs and commits.
// (Sprint 176)
// [why] Each generated sprint and as-built run produces artifacts (sprint-<n>.md,
// changelogs, commits) that should be discoverable from the feature card.
// This component renders clickable links to those artifacts.

import React from 'react';

export interface SprintArtifactLink {
  /** Display label for the link. */
  label: string;
  /** URL or path to the artifact. */
  url: string;
  /** Type discriminator for styling. */
  type: 'sprint-spec' | 'changelog' | 'commit' | 'architecture' | 'security';
}

export interface SprintArtifactLinksProps {
  /** List of artifact links to display. */
  artifacts: SprintArtifactLink[];
  /** Optional title override. */
  title?: string;
}

const TYPE_ICONS: Record<string, string> = {
  'sprint-spec': '📋',
  changelog: '📝',
  commit: '🔗',
  architecture: '🏗',
  security: '🔒',
};

/**
 * Render links to sprint generation and as-built sync artifacts.
 */
export default function SprintArtifactLinks({
  artifacts,
  title = 'Generated Artifacts',
}: SprintArtifactLinksProps) {
  if (artifacts.length === 0) {
    return null;
  }

  return (
    <div className="sprint-artifact-links" data-testid="artifact-links">
      <h4 style={styles.title}>{title}</h4>
      <ul style={styles.list}>
        {artifacts.map((artifact, i) => (
          <li key={`${artifact.type}-${i}`} style={styles.item}>
            <span style={styles.icon}>
              {TYPE_ICONS[artifact.type] || '📄'}
            </span>
            <a
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
              data-testid={`artifact-link-${artifact.type}`}
            >
              {artifact.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 0 8px 0',
    color: '#24292f',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
    gap: '8px',
    fontSize: '13px',
  },
  icon: {
    fontSize: '14px',
    flexShrink: 0,
  },
  link: {
    color: '#0969da',
    textDecoration: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
};
