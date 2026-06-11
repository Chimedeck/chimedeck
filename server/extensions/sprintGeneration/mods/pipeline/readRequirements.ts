// Sprint 176 — Read requirements module.
// [why] Reads the card's refined requirement packet from the cardChat
// extension (card_chat_sessions READY_FOR_REVIEW state) and fetches the
// latest context snapshot from aiContext to provide input to sprint generation.
import { db } from '../../../../common/db';
import type {
  ReadRequirementsInput,
  ReadRequirementsOutput,
  RequirementPacket,
  ContextSnapshotSummary,
} from '../../types';

export const readRequirementsDeps = {
  db,
};

/**
 * Read the refined requirement packet from a card's READY_FOR_REVIEW chat session.
 * [why] The cardChat BA persona loop transitions the session to READY_FOR_REVIEW
 * when quality score ≥ 90. We read the latest such session and extract the
 * structured requirement fields from the card description.
 */
async function fetchRequirementPacket(cardId: string): Promise<RequirementPacket | null> {
  // 1. Find the latest READY_FOR_REVIEW chat session for this card
  const session = await readRequirementsDeps
    .db('card_chat_sessions')
    .where({ card_id: cardId, status: 'READY_FOR_REVIEW' })
    .orderBy('updated_at', 'desc')
    .first();

  if (!session) return null;

  // 2. Get the card metadata
  const card = await readRequirementsDeps
    .db('cards')
    .where({ id: cardId })
    .select('title', 'description')
    .first();

  if (!card) return null;

  // 3. Extract structured fields from the card description
  // [why] The BA persona appends an "## AI-Refined Requirements" block
  // to the card description. We parse this block for the structured fields.
  const description = (card.description as string | null) ?? '';

  return parseRequirementPacket({
    cardTitle: card.title as string,
    cardDescription: description,
    qualityScore: (session.quality_score as number) ?? 0,
    sessionId: session.id as string,
  });
}

/**
 * Parse the refined requirement packet from card description text.
 * [why] The BA persona writes structured content in a predictable format:
 * - ## AI-Refined Requirements
 * - ### Business Value
 * - ### EARS Requirements
 * - ### Acceptance Criteria
 * - ### Constraints
 */
function parseRequirementPacket({
  cardTitle,
  cardDescription,
  qualityScore,
  sessionId,
}: {
  cardTitle: string;
  cardDescription: string;
  qualityScore: number;
  sessionId: string;
}): RequirementPacket {
  const businessValue = extractSection(cardDescription, 'Business Value', 'EARS Requirements');
  const earsRequirements = extractListItems(cardDescription, 'EARS Requirements', 'Acceptance Criteria');
  const acceptanceCriteria = extractListItems(cardDescription, 'Acceptance Criteria', 'Constraints');
  const constraints = extractListItems(cardDescription, 'Constraints', '');

  return {
    cardTitle,
    cardDescription,
    businessValue: businessValue || cardDescription.split('## AI-Refined Requirements')[0]?.trim() || '',
    earsRequirements: earsRequirements.length > 0 ? earsRequirements : [cardDescription],
    acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : ['Verify the requirement is met'],
    constraints: constraints.length > 0 ? constraints : ['No explicit constraints documented'],
    qualityScore,
    sessionId,
  };
}

/** Extract a text block between two section headers. */
function extractSection(text: string, startHeader: string, endHeader: string): string {
  const startIdx = text.indexOf(`### ${startHeader}`);
  if (startIdx === -1) return '';

  const afterStart = text.substring(startIdx + `### ${startHeader}`.length);
  const endIdx = endHeader ? afterStart.indexOf('###') : -1;

  return endIdx === -1 ? afterStart.trim() : afterStart.substring(0, endIdx).trim();
}

/** Extract list items (lines starting with `-` or `*`) from a section. */
function extractListItems(text: string, startHeader: string, endHeader: string): string[] {
  const section = extractSection(text, startHeader, endHeader);
  if (!section) return [];

  const lines = section.split('\n');
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      items.push(trimmed.replace(/^[-*]\s+/, ''));
    }
  }

  return items;
}

/**
 * Fetch the latest context snapshot for the card from aiContext.
 */
async function fetchContextSnapshot(cardId: string): Promise<ContextSnapshotSummary | null> {
  const snapshot = await readRequirementsDeps
    .db('card_ai_context_snapshots')
    .where({ card_id: cardId })
    .orderBy('created_at', 'desc')
    .first();

  if (!snapshot) return null;

  return {
    snapshotId: snapshot.id as string,
    totalChunks: snapshot.total_chunks as number,
    sourceCounts: {},
    focusPaths: snapshot.focus_paths ? (JSON.parse(snapshot.focus_paths as string) as string[]) : [],
  };
}

/**
 * Read requirements for a card — the main entry point.
 * Returns the requirement packet and context snapshot needed for sprint generation.
 */
export async function readRequirements({
  cardId,
}: ReadRequirementsInput): Promise<ReadRequirementsOutput> {
  // 1. Fetch requirement packet
  const requirementPacket = await fetchRequirementPacket(cardId);
  if (!requirementPacket) {
    return {
      status: 422,
      name: 'no-refined-requirements',
      message: 'No READY_FOR_REVIEW chat session found for this card. Run the AI refinement loop first.',
    };
  }

  // 2. Fetch context snapshot (best-effort — not required for basic generation)
  const contextSnapshot = await fetchContextSnapshot(cardId);

  return {
    status: 200,
    data: {
      requirementPacket,
      contextSnapshot: contextSnapshot ?? {
        snapshotId: '',
        totalChunks: 0,
        sourceCounts: {},
        focusPaths: [],
      },
    },
  };
}
