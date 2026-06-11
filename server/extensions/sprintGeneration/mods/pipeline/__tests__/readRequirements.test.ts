// Tests for readRequirements — verifies fetching refined requirement packets
// and context snapshots from cross-extension tables.
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { ReadRequirementsInput } from '../../../types';

// [why] Use shared mock DB to avoid cross-file mock.module pollution.
import { sharedMockDb, sharedMockFirst, resetMockDb } from '../../../__tests__/mockDb';

mock.module('../../../../../common/db', () => ({
  db: sharedMockDb,
}));

describe('readRequirements', () => {
  beforeEach(() => {
    sharedMockFirst.mockReset();
  });

  it('returns requirements packet and context snapshot when all data exists', async () => {
    // [why] The module reads card title/description, parsing ## AI-Refined Requirements sections
    const mockSession = {
      id: 'session-1',
      card_id: 'card-1',
      status: 'READY_FOR_REVIEW',
      quality_score: 95,
      workspace_id: 'ws-1',
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockCard = {
      id: 'card-1',
      title: 'Personalised Dashboard',
      description: [
        '## AI-Refined Requirements',
        '',
        '### Business Value',
        'Increase user engagement by 30%',
        '',
        '### EARS Requirements',
        '- WHEN the user opens the dashboard THEN the system SHALL display personalised recommendations within 2 seconds',
        '',
        '### Acceptance Criteria',
        '- Recommendations are visible on first load',
        '- Response time is under 2 seconds',
        '',
        '### Constraints',
        '- Must work offline',
        '- GDPR compliant',
      ].join('\n'),
    };

    const mockSnapshot = {
      id: 'snap-1',
      card_id: 'card-1',
      total_chunks: 5,
      focus_paths: JSON.stringify(['src/dashboard/', 'src/recommendations/']),
      created_at: new Date().toISOString(),
    };

    // Sequence: session → card → snapshot
    sharedMockFirst.mockResolvedValueOnce(mockSession);
    sharedMockFirst.mockResolvedValueOnce(mockCard);
    sharedMockFirst.mockResolvedValueOnce(mockSnapshot);

    const { readRequirements } = await import('../readRequirements');

    const input: ReadRequirementsInput = { cardId: 'card-1' };
    const result = await readRequirements(input);

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(result.data!.requirementPacket).toBeDefined();
    expect(result.data!.requirementPacket!.businessValue).toBe('Increase user engagement by 30%');
    expect(result.data!.requirementPacket!.earsRequirements).toHaveLength(1);
    expect(result.data!.requirementPacket!.acceptanceCriteria).toHaveLength(2);
    expect(result.data!.requirementPacket!.constraints).toHaveLength(2);
    expect(result.data!.requirementPacket!.qualityScore).toBe(95);
    expect(result.data!.contextSnapshot).toBeDefined();
    expect(result.data!.contextSnapshot!.totalChunks).toBe(5);
  });

  it('returns error when card has no READY_FOR_REVIEW session', async () => {
    sharedMockFirst.mockResolvedValueOnce(null); // session query returns null

    const { readRequirements } = await import('../readRequirements');

    const input: ReadRequirementsInput = { cardId: 'card-2' };
    const result = await readRequirements(input);

    expect(result.status).toBe(422);
    expect(result.name).toBe('no-refined-requirements');
    expect(result.message).toContain('READY_FOR_REVIEW');
  });

  it('returns error when card metadata lookup fails', async () => {
    const mockSession = {
      id: 'session-3',
      card_id: 'card-3',
      status: 'READY_FOR_REVIEW',
      quality_score: 90,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    sharedMockFirst.mockResolvedValueOnce(mockSession);
    sharedMockFirst.mockResolvedValueOnce(null); // card lookup returns null

    const { readRequirements } = await import('../readRequirements');

    const input: ReadRequirementsInput = { cardId: 'card-3' };
    const result = await readRequirements(input);

    expect(result.status).toBe(422);
    expect(result.name).toBe('no-refined-requirements');
  });

  it('returns default context snapshot when none exists', async () => {
    const mockSession = {
      id: 'session-4',
      card_id: 'card-4',
      status: 'READY_FOR_REVIEW',
      quality_score: 92,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockCard = {
      id: 'card-4',
      title: 'Basic Feature',
      description: [
        '## AI-Refined Requirements',
        '',
        '### Business Value',
        'Basic feature',
        '',
        '### EARS Requirements',
        '- WHEN X THEN Y',
        '',
        '### Acceptance Criteria',
        '- Works',
        '',
        '### Constraints',
      ].join('\n'),
    };

    sharedMockFirst.mockResolvedValueOnce(mockSession);
    sharedMockFirst.mockResolvedValueOnce(mockCard);
    sharedMockFirst.mockResolvedValueOnce(null); // snapshot query returns null

    const { readRequirements } = await import('../readRequirements');

    const input: ReadRequirementsInput = { cardId: 'card-4' };
    const result = await readRequirements(input);

    expect(result.status).toBe(200);
    // Default fallback context — not null
    expect(result.data!.contextSnapshot!.snapshotId).toBe('');
    expect(result.data!.contextSnapshot!.totalChunks).toBe(0);
  });

  it('uses latest READY_FOR_REVIEW session when multiple exist', async () => {
    const mockSession = {
      id: 'session-latest',
      card_id: 'card-5',
      status: 'READY_FOR_REVIEW',
      quality_score: 96,
      workspace_id: 'ws-1',
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockCard = {
      id: 'card-5',
      title: 'Latest Refinement',
      description: [
        '## AI-Refined Requirements',
        '',
        '### Business Value',
        'Latest refinement',
        '',
        '### EARS Requirements',
        '- WHEN A THEN B',
        '',
        '### Acceptance Criteria',
        '- Done',
        '',
        '### Constraints',
      ].join('\n'),
    };

    sharedMockFirst.mockResolvedValueOnce(mockSession);
    sharedMockFirst.mockResolvedValueOnce(mockCard);
    sharedMockFirst.mockResolvedValueOnce(null);

    const { readRequirements } = await import('../readRequirements');

    const input: ReadRequirementsInput = { cardId: 'card-5' };
    const result = await readRequirements(input);

    expect(result.status).toBe(200);
    expect(result.data!.requirementPacket!.qualityScore).toBe(96);
  });
});
