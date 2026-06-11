// CardActivity — rich event renderers for Sprint 176 activity events.
// [why] While most system events render as a single text label, sprint
// generation and as-built sync events carry structured payloads (file
// diffs, artifact links, approve/re-run controls) that need richer UI.
// This extension provides event-type-aware renderers that slot into
// the existing ActivityFeed in CardModal.
export { ActivityEventRenderer, isRichEventType } from './components/ActivityEventRenderer';
export type { ActivityEventRendererProps } from './components/ActivityEventRenderer';
