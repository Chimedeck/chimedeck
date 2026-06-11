// GeneratedDiffSummary — shows file changes from sprint generation or
// as-built sync with inline status indicators. (Sprint 176)
// [why] Renders a compact diff summary in the card activity stream so
// users can see what files were added/modified without leaving the board.

import React from 'react';

interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

export interface GeneratedDiffSummaryProps {
  /** List of files changed by the generation/sync run. */
  changedFiles: ChangedFile[];
  /** Optional run ID for linking to details. */
  runId?: string;
  /** Whether this is an as-built sync (vs sprint generation). */
  isAsBuilt?: boolean;
  /** Optional callback when a file path is clicked. */
  onFileClick?: (path: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  added: '#2ea44f',
  modified: '#d29922',
  deleted: '#cb2431',
};

const STATUS_LABELS: Record<string, string> = {
  added: '+',
  modified: '~',
  deleted: '-',
};

/**
 * Compact diff summary component.
 * Displays a list of changed files with color-coded status indicators.
 */
export default function GeneratedDiffSummary({
  changedFiles,
  runId,
  isAsBuilt = false,
  onFileClick,
}: GeneratedDiffSummaryProps) {
  if (changedFiles.length === 0) {
    return (
      <div className="diff-summary empty" data-testid="diff-summary-empty">
        <p style={styles.emptyText}>No file changes detected.</p>
      </div>
    );
  }

  const title = isAsBuilt ? 'As-Built Sync Changes' : 'Generated Sprint Files';

  return (
    <div className="diff-summary" data-testid="diff-summary">
      <h4 style={styles.title}>
        {title}
        {runId && (
          <span style={styles.runId}> · Run {runId.slice(0, 8)}</span>
        )}
      </h4>
      <ul style={styles.fileList}>
        {changedFiles.map((file) => (
          <li
            key={file.path}
            style={styles.fileItem}
            data-testid={`diff-file-${file.status}`}
          >
            <span
              style={{
                ...styles.statusBadge,
                backgroundColor: STATUS_COLORS[file.status] || '#888',
              }}
              title={file.status}
            >
              {STATUS_LABELS[file.status] || '?'}
            </span>
            <span
              style={{
                ...styles.filePath,
                cursor: onFileClick ? 'pointer' : 'default',
                color: onFileClick ? '#0969da' : 'inherit',
              }}
              onClick={() => onFileClick?.(file.path)}
              title={file.path}
            >
              {file.path}
            </span>
            <span style={styles.fileStatus}>{file.status}</span>
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
  runId: {
    fontWeight: 400,
    fontSize: '12px',
    color: '#656d76',
    marginLeft: '4px',
  },
  fileList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
    fontSize: '13px',
    gap: '8px',
    borderBottom: '1px solid #d0d7de',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  },
  filePath: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  fileStatus: {
    fontSize: '11px',
    color: '#656d76',
    textTransform: 'capitalize' as const,
    flexShrink: 0,
  },
  emptyText: {
    fontSize: '13px',
    color: '#656d76',
    fontStyle: 'italic',
  },
};
