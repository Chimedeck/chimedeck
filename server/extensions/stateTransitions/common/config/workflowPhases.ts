// Valid workflow phases for column metadata (Sprint 172).
// These are the only values accepted in StateTransitionNode.workflowPhases.
import type { WorkflowPhase } from '../types';

const VALID_WORKFLOW_PHASES: WorkflowPhase[] = [
  'NEW_DRAFT',
  'REFINED_PENDING_REVIEW',
  'SYNC_DOCUMENT',
  'READY_FOR_DEV',
  'GENERATE_SPRINT',
  'UPDATE_AS_BUILT',
];

const WORKFLOW_PHASE_LABELS: Record<WorkflowPhase, string> = {
  NEW_DRAFT: 'New Draft',
  REFINED_PENDING_REVIEW: 'Refined — Pending Review',
  SYNC_DOCUMENT: 'Sync Document',
  READY_FOR_DEV: 'Ready for Dev',
  GENERATE_SPRINT: 'Generate Sprint',
  UPDATE_AS_BUILT: 'Update As-Built',
};

export { VALID_WORKFLOW_PHASES, WORKFLOW_PHASE_LABELS };
