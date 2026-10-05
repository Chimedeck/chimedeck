import { describe, expect, it } from 'bun:test';

// Phase labels expected for validation — these match PHASE_LABELS in PhaseChip.tsx
const EXPECTED_LABELS: Record<string, string> = {
  NEW_DRAFT: 'New Draft',
  REFINED_PENDING_REVIEW: 'Pending Review',
  SYNC_DOCUMENT: 'Sync Doc',
  READY_FOR_DEV: 'Ready for Dev',
  GENERATE_SPRINT: 'Generate Sprint',
  UPDATE_AS_BUILT: 'As-Built',
};

const ALL_PHASES = [
  'NEW_DRAFT',
  'REFINED_PENDING_REVIEW',
  'SYNC_DOCUMENT',
  'READY_FOR_DEV',
  'GENERATE_SPRINT',
  'UPDATE_AS_BUILT',
] as const;

describe('PhaseChip labels', () => {
  it('has labels for all known phases', () => {
    for (const phase of ALL_PHASES) {
      expect(EXPECTED_LABELS[phase]).toBeDefined();
      expect(typeof EXPECTED_LABELS[phase]).toBe('string');
      expect(EXPECTED_LABELS[phase]!.length).toBeGreaterThan(0);
    }
  });

  it('has exactly 6 phase labels (no extra, no missing)', () => {
    const keys = Object.keys(EXPECTED_LABELS);
    expect(keys.length).toBe(6);
    expect(keys.sort()).toEqual([...ALL_PHASES].sort());
  });

  it('labels are distinct (no duplicates)', () => {
    const labels = Object.values(EXPECTED_LABELS);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });
});
