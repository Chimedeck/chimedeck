// ApproveRerunControls — approval and re-run buttons for generated outputs.
// (Sprint 176)
// [why] When phase metadata requires human approval before final commit,
// these controls let the user approve, edit, or re-run the generation.
// They appear in the card activity stream alongside the diff summary.

import React, { useState } from 'react';

export interface ApproveRerunControlsProps {
  /** The type of run being approved/re-run. */
  runType: 'sprint-generation' | 'as-built-sync';
  /** The run ID to approve or re-run. */
  runId: string;
  /** Whether approval is required (from phase metadata). */
  approvalRequired?: boolean;
  /** Whether the run is currently in progress. */
  isRunning?: boolean;
  /** Callback when the user clicks Approve. */
  onApprove?: (runId: string) => void | Promise<void>;
  /** Callback when the user clicks Re-run. */
  onRerun?: (runId: string) => void | Promise<void>;
  /** Callback when the user clicks Edit. */
  onEdit?: (runId: string) => void | Promise<void>;
  /** Whether the run succeeded and can be approved. */
  runSucceeded?: boolean;
}

/**
 * Approve/Re-run/Edit controls for sprint generation and as-built sync.
 */
export default function ApproveRerunControls({
  runType,
  runId,
  approvalRequired = false,
  isRunning = false,
  onApprove,
  onRerun,
  onEdit,
  runSucceeded = false,
}: ApproveRerunControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (
    action: 'approve' | 'rerun' | 'edit',
    handler?: (runId: string) => void | Promise<void>
  ) => {
    if (!handler || loading) return;
    setLoading(action);
    try {
      await handler(runId);
    } finally {
      setLoading(null);
    }
  };

  const runTypeLabel = runType === 'sprint-generation' ? 'Sprint Generation' : 'As-Built Sync';

  return (
    <div className="approve-rerun-controls" data-testid="approve-rerun-controls">
      <div style={styles.container}>
        <span style={styles.label}>{runTypeLabel}</span>
        <div style={styles.buttonGroup}>
          {approvalRequired && runSucceeded && onApprove && (
            <button
              style={styles.approveButton}
              onClick={() => handleAction('approve', onApprove)}
              disabled={isRunning || loading !== null}
              data-testid="approve-button"
            >
              {loading === 'approve' ? 'Approving…' : '✓ Approve'}
            </button>
          )}
          {onEdit && (
            <button
              style={styles.editButton}
              onClick={() => handleAction('edit', onEdit)}
              disabled={isRunning || loading !== null}
              data-testid="edit-button"
            >
              {loading === 'edit' ? 'Opening…' : '✎ Edit'}
            </button>
          )}
          {onRerun && (
            <button
              style={styles.rerunButton}
              onClick={() => handleAction('rerun', onRerun)}
              disabled={isRunning || loading !== null}
              data-testid="rerun-button"
            >
              {loading === 'rerun' ? 'Re-running…' : isRunning ? '⟳ Running…' : '⟳ Re-run'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderTop: '1px solid #d0d7de',
    marginTop: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#24292f',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  approveButton: {
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#2da44e',
    border: '1px solid #2c974b',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  editButton: {
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#24292f',
    backgroundColor: '#f6f8fa',
    border: '1px solid #d0d7de',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  rerunButton: {
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#0969da',
    backgroundColor: '#ddf4ff',
    border: '1px solid #54aeff',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
