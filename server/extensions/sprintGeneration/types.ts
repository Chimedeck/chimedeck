// Shared types for sprintGeneration extension (Sprint 176).
// Follows the cardChat/types.ts and aiEditOrchestrator/types.ts patterns.
import type { SprintGenRunStatus } from '../common/config';

// ── DB entities ──

/** DB row for card_sprint_generation_runs. */
export interface SprintGenerationRun {
  id: string;
  card_id: string;
  workspace_id: string;
  created_by: string;
  status: SprintGenRunStatus;
  tier: string | null;
  snapshot_id: string | null;
  trigger_run_id: string | null;
  output_files: string[] | null;
  requirement_packet: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** DB row for generated_sprint_cards. */
export interface GeneratedSprintCard {
  id: string;
  sprint_card_id: string;
  feature_card_id: string;
  sprint_generation_run_id: string;
  sprint_number: number;
  sprint_spec_path: string | null;
  trace_links: Record<string, unknown> | null;
  created_at: string;
}

// ── Pipeline inputs / outputs ──

/** Input to the readRequirements step. */
export interface ReadRequirementsInput {
  cardId: string;
}

/** Output from the readRequirements step. */
export interface ReadRequirementsOutput {
  status: number;
  name?: string;
  message?: string;
  data?: {
    requirementPacket: RequirementPacket;
    contextSnapshot: ContextSnapshotSummary;
  };
}

/** The refined requirement extracted from a READY_FOR_REVIEW card chat session. */
export interface RequirementPacket {
  cardTitle: string;
  cardDescription: string;
  businessValue: string;
  earsRequirements: string[];
  acceptanceCriteria: string[];
  constraints: string[];
  qualityScore: number;
  /** The session ID of the READY_FOR_REVIEW chat session. */
  sessionId: string;
}

/** A summary of the context snapshot used for generation. */
export interface ContextSnapshotSummary {
  snapshotId: string;
  totalChunks: number;
  sourceCounts: Record<string, number>;
  focusPaths: string[];
}

/** Input to the generateArtifacts step. */
export interface GenerateArtifactsInput {
  cardId: string;
  requirementPacket: RequirementPacket;
  contextSnapshot: ContextSnapshotSummary;
  tier: string;
}

/** A single generated sprint artifact. */
export interface SprintArtifact {
  sprintNumber: number;
  title: string;
  filePath: string;
  content: string;
  /** EARS requirements in this sprint */
  requirements: string[];
  /** Acceptance criteria for this sprint */
  acceptanceCriteria: string[];
  /** Test scenarios for this sprint */
  testScenarios: string[];
  /** Dependencies on other sprints */
  dependencies: number[];
}

/** Output from the generateArtifacts step. */
export interface GenerateArtifactsOutput {
  status: number;
  name?: string;
  message?: string;
  data?: {
    artifacts: SprintArtifact[];
    sprintPlanUpdated: boolean;
    changelogCreated: boolean;
    dependencyGraph?: string; // tier_3+
    architectureDelta?: string; // tier_3+
    testMatrix?: string; // tier_4
    riskRegister?: string; // tier_4
  };
}

/** Input to the createSprintCards step. */
export interface CreateSprintCardsInput {
  cardId: string;
  workspaceId: string;
  boardId: string;
  userId: string;
  runId: string;
  artifacts: SprintArtifact[];
  /** List ID to place sprint cards in (from trigger metadata). */
  destinationListId?: string;
}

/** Output from the createSprintCards step. */
export interface CreateSprintCardsOutput {
  status: number;
  name?: string;
  message?: string;
  data?: {
    createdCards: Array<{
      sprintCardId: string;
      sprintNumber: number;
      sprintSpecPath: string;
    }>;
    skippedCards: Array<{
      sprintNumber: number;
      reason: string;
    }>;
  };
}

// ── Tier policy ──

/** Input to the tier policy resolver. */
export interface TierPolicyInput {
  tier: string;
  sprintCount: number;
}

/** Result from tier policy enforcement. */
export interface TierPolicyResult {
  /** Whether the request is within tier limits. */
  allowed: boolean;
  /** Maximum sprints allowed (or 'unlimited'). */
  maxSprints: number | 'unlimited';
  /** Whether dependency graph can be generated. */
  dependencyGraph: boolean;
  /** Whether test matrix can be generated. */
  testMatrix: boolean;
  /** Whether risk register can be generated. */
  riskRegister: boolean;
  /** Whether human approval is required before final commit. */
  requiresHumanApproval: boolean;
  /** Sprints that were truncated due to quota. */
  truncatedSprints: Array<{
    sprintNumber: number;
    reason: string;
  }>;
  /** Upgrade hint if quota exceeded. */
  upgradeHint?: string;
}

// ── Activity events ──

export type SprintGenActivityType =
  | 'sprint_generation_started'
  | 'sprint_generation_artifact_created'
  | 'sprint_generation_card_created'
  | 'sprint_generation_quota_exceeded'
  | 'sprint_generation_completed'
  | 'sprint_generation_failed';

export interface SprintGenActivityInput {
  type: SprintGenActivityType;
  cardId: string;
  boardId: string | null;
  runId: string;
  actorId: string;
  payload?: Record<string, unknown>;
}

// ── API request/response ──

/** POST /api/v1/cards/:cardId/sprint/generate request body. */
export interface GenerateSprintRequest {
  /** Optional: reuse a pre-gathered context snapshot. */
  snapshotId?: string;
  /** Optional: override the board where sprint cards are created. */
  boardId?: string;
}

/** POST /api/v1/cards/:cardId/sprint/generate response. */
export interface GenerateSprintResponse {
  status: number;
  name?: string;
  message?: string;
  data?: {
    run: SprintGenerationRun;
  };
}
