// SprintGenEvent — renders sprint generation activity events with
// diff summary, artifact links, and approve/re-run controls. (Sprint 176)
// [why] Sprint generation events carry structured output (changed files,
// sprint artifacts, run metadata) that should be visually distinguished
// from generic text-only system events.
import React from 'react';
import type { ActivityData } from '~/extensions/Card/slices/cardDetailSlice';
import GeneratedDiffSummary from '~/extensions/SprintGeneration/components/GeneratedDiffSummary';
import ApproveRerunControls from '~/extensions/SprintGeneration/components/ApproveRerunControls';
import SprintArtifactLinks from '~/extensions/SprintGeneration/components/SprintArtifactLinks';
import type { SprintArtifactLink } from '~/extensions/SprintGeneration/components/SprintArtifactLinks';

interface SprintGenEventProps {
  activity: ActivityData;
  cardId: string;
  onFileClick?: (path: string) => void;
  onApprove?: (runId: string) => void | Promise<void>;
  onRerun?: (runId: string) => void | Promise<void>;
  onEdit?: (runId: string) => void | Promise<void>;
}

function filesFromPayload(
  payload: Record<string, unknown>
): Array<{ path: string; status: 'added' | 'modified' | 'deleted' }> {
  const files = payload.changedFiles;
  if (!Array.isArray(files)) return [];
  return files.filter(
    (f): f is { path: string; status: 'added' | 'modified' | 'deleted' } =>
      typeof f === 'object' &&
      f !== null &&
      typeof (f as { path?: unknown }).path === 'string' &&
      ['added', 'modified', 'deleted'].includes((f as { status?: string }).status ?? '')
  );
}

function artifactsFromPayload(payload: Record<string, unknown>): SprintArtifactLink[] {
  const links = payload.artifactLinks;
  if (!Array.isArray(links)) return [];
  return links.filter(
    (l): l is SprintArtifactLink =>
      typeof l === 'object' &&
      l !== null &&
      typeof (l as { label?: unknown }).label === 'string' &&
      typeof (l as { url?: unknown }).url === 'string' &&
      ['sprint-spec', 'changelog', 'commit', 'architecture', 'security'].includes(
        (l as { type?: string }).type ?? ''
      )
  );
}

/**
 * Renders sprint generation activity event with rich components.
 * Shows diff summary for completed/artifact_created events,
 * artifact links for card_created events, and controls for
 * succeeded/failed states.
 */
export default function SprintGenEvent({
  activity,
  cardId: _cardId,
  onFileClick,
  onApprove,
  onRerun,
  onEdit,
}: SprintGenEventProps) {
  const { action, payload } = activity;
  const runId = typeof payload.runId === 'string' ? payload.runId : '';
  const changedFiles = filesFromPayload(payload);
  const artifactLinks = artifactsFromPayload(payload);
  // [why] Read tier-policy metadata from the event payload to gate
  // approve button visibility according to the user's subscription tier.
  const requiresHumanApproval =
    typeof payload.requiresHumanApproval === 'boolean' ? payload.requiresHumanApproval : false;

  const isCompleted = action === 'sprint_generation_completed';
  const isFailed = action === 'sprint_generation_failed';
  const isCardCreated = action === 'sprint_generation_card_created';
  const isArtifactCreated = action === 'sprint_generation_artifact_created';
  const isStarted = action === 'sprint_generation_started';

  return (
    <div className="sprint-gen-event" style={styles.container}>
      {/* Diff summary for events that include file changes */}
      {(isCompleted || isArtifactCreated) && changedFiles.length > 0 && (
        <GeneratedDiffSummary
          changedFiles={changedFiles}
          runId={runId}
          isAsBuilt={false}
          onFileClick={onFileClick}
        />
      )}

      {/* Artifact links for card_created and completed events */}
      {(isCardCreated || isCompleted) && artifactLinks.length > 0 && (
        <SprintArtifactLinks
          artifacts={artifactLinks}
          title={isCardCreated ? 'Created Sprint Cards' : 'Generated Artifacts'}
        />
      )}

      {/* Approve/re-run/edit controls for completed, failed, or started states */}
      {(isCompleted || isFailed || isStarted) && runId && (
        <ApproveRerunControls
          runType="sprint-generation"
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
