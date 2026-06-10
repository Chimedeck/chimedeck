// AsBuiltEvent — renders as-built sync activity events with
// diff summary, commit info, and approve/re-run controls. (Sprint 176)
// [why] As-built sync events carry evidence (PRs, changed files, test
// results) that should be displayed alongside the standard text label.
import React from 'react';
import type { ActivityData } from '~/extensions/Card/slices/cardDetailSlice';
import GeneratedDiffSummary from '~/extensions/SprintGeneration/components/GeneratedDiffSummary';
import ApproveRerunControls from '~/extensions/SprintGeneration/components/ApproveRerunControls';
import SprintArtifactLinks from '~/extensions/SprintGeneration/components/SprintArtifactLinks';
import type { SprintArtifactLink } from '~/extensions/SprintGeneration/components/SprintArtifactLinks';

interface AsBuiltEventProps {
  activity: ActivityData;
  cardId: string;
  onFileClick?: (path: string) => void;
  onApprove?: (runId: string) => void | Promise<void>;
  onRerun?: (runId: string) => void | Promise<void>;
  onEdit?: (runId: string) => void | Promise<void>;
}

function filesFromPayload(payload: Record<string, unknown>): Array<{ path: string; status: 'added' | 'modified' | 'deleted' }> {
  const files = payload.changedFiles;
  if (!Array.isArray(files)) return [];
  return files.filter(
    (f): f is { path: string; status: 'added' | 'modified' | 'deleted' } =>
      typeof f === 'object' && f !== null &&
      typeof (f as { path?: unknown }).path === 'string' &&
      ['added', 'modified', 'deleted'].includes((f as { status?: string }).status ?? ''),
  );
}

function commitLinksFromPayload(payload: Record<string, unknown>): SprintArtifactLink[] {
  const links: SprintArtifactLink[] = [];
  const hash = typeof payload.commitHash === 'string' && payload.commitHash ? payload.commitHash : null;
  if (hash) {
    links.push({ label: `Commit ${hash.slice(0, 7)}`, url: `#commit-${hash}`, type: 'commit' });
  }
  const files = payload.updatedFiles;
  if (Array.isArray(files)) {
    for (const f of files) {
      if (typeof f === 'string') {
        const isArch = f.includes('architecture');
        const isSecurity = f.includes('security');
        const type = isArch ? 'architecture' : isSecurity ? 'security' : 'changelog';
        links.push({ label: f, url: `#file-${f}`, type });
      }
    }
  }
  return links;
}

/**
 * Renders as-built sync activity event with rich components.
 */
export default function AsBuiltEvent({
  activity,
  cardId: _cardId,
  onFileClick,
  onApprove,
  onRerun,
  onEdit,
}: AsBuiltEventProps) {
  const { action, payload } = activity;
  const runId = typeof payload.runId === 'string' ? payload.runId : '';
  const changedFiles = filesFromPayload(payload);
  const links = commitLinksFromPayload(payload);
  // [why] As-built sync defaults to not requiring human approval —
  // it's a documentation sync that auto-commits.
  const requiresHumanApproval = typeof payload.requiresHumanApproval === 'boolean'
    ? payload.requiresHumanApproval
    : false;

  const isCompleted = action === 'as_built_sync_completed';
  const isFailed = action === 'as_built_sync_failed';
  const isCommitted = action === 'as_built_sync_committed';
  const isStarted = action === 'as_built_sync_started';
  const isDocsUpdated = action === 'as_built_sync_docs_updated';

  return (
    <div className="as-built-event" style={styles.container}>
      {/* Diff summary for events with file changes */}
      {(isCompleted || isDocsUpdated || isCommitted) && changedFiles.length > 0 && (
        <GeneratedDiffSummary
          changedFiles={changedFiles}
          runId={runId}
          isAsBuilt={true}
          onFileClick={onFileClick}
        />
      )}

      {/* Commit and doc links */}
      {(isCommitted || isCompleted) && links.length > 0 && (
        <SprintArtifactLinks
          artifacts={links}
          title="As-Built Sync Artifacts"
        />
      )}

      {/* Controls */}
      {(isCompleted || isFailed || isStarted) && runId && (
        <ApproveRerunControls
          runType="as-built-sync"
          runId={runId}
          approvalRequired={isCompleted && requiresHumanApproval}
          isRunning={isStarted}
          runSucceeded={isCompleted}
          onApprove={onApprove}
          onRerun={onRerun}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: '#f6f8fa',
    borderRadius: '6px',
    border: '1px solid #d0d7de',
    fontSize: '13px',
  },
};
