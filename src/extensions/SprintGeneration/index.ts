// SprintGeneration extension entry point (Sprint 176).
// [why] Barrel export registering components into card activity and card modal
// slots. Follows the BoardChat/index.ts pattern.
export { default as GeneratedDiffSummary } from './components/GeneratedDiffSummary';
export { default as ApproveRerunControls } from './components/ApproveRerunControls';
export { default as SprintArtifactLinks } from './components/SprintArtifactLinks';
export {
  generateSprint,
  syncAsBuilt,
  getSprintGenRun,
  getAsBuiltRun,
} from './api';
export type {
  SprintGenerationRun,
  AsBuiltSyncRun,
  AsBuiltEvidence,
  GenerateSprintRequest,
  GenerateSprintResponse,
  AsBuiltSyncResponse,
  GetSprintGenRunResponse,
  GetAsBuiltRunResponse,
} from './api';
export type {
  GeneratedDiffSummaryProps,
} from './components/GeneratedDiffSummary';
export type {
  ApproveRerunControlsProps,
} from './components/ApproveRerunControls';
export type {
  SprintArtifactLink,
  SprintArtifactLinksProps,
} from './components/SprintArtifactLinks';
