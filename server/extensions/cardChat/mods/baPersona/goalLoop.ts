// BA persona goal loop — multi-turn refinement orchestrator.
// Drives the AI through structured requirement discovery across
// four categories (business value, EARS requirements, acceptance
// criteria, constraints), scoring quality after each turn, and
// terminating when score reaches QUALITY_THRESHOLD (90).

import { requestCardChatCompletion } from '../provider';
import {
  buildBAPersonaSystemPrompt,
  selectNextQuestionCategory,
  buildCategoryQuestion,
  detectCoveredCategories,
} from './index';
import { computeQualityScore, QUALITY_THRESHOLD } from '../qualityScore';
import { emitCardChatActivity } from '../activities';
import { writeCardChatMessage } from '../messages/write';
import { db } from '../../../../common/db';
import {
  extractStructuredFields,
  hasAnyStructuredContent,
  formatStructuredBlock,
} from './structuredExtraction';
import type {
  CardChatSession,
  CardChatMessage,
  CardChatProviderMessage,
  GoalQuestionCategory,
  QualityScoreBreakdown,
  RefineCardChatInput,
  RefineCardChatResult,
  CardChatSessionStatus,
} from '../../types';

// [why] Prevent runaway loops. Each iteration is one assistant turn + user
// answer pair. 8 iterations is generous — most requirements reach 90 in 3-5.
const MAX_REFINEMENT_TURNS = 8;

// [why] Only consider recent user messages (last 20) when detecting covered
// categories — old context is less relevant and may cause false positives.
const RECENT_USER_MESSAGES_LIMIT = 20;

interface ConversationTurn {
  assistantMessage: CardChatMessage | null;
  category: GoalQuestionCategory;
  score: QualityScoreBreakdown;
}

interface CardMeta {
  id: string;
  title: string;
  description: string | null;
}

interface GoalLoopContext {
  session: CardChatSession;
  card: CardMeta;
  userId: string;
}

export const goalLoopDeps = {
  requestCardChatCompletion,
  computeQualityScore,
  emitCardChatActivity,
  writeCardChatMessage,
  db,
  selectNextQuestionCategory,
  buildCategoryQuestion,
  detectCoveredCategories,
  buildBAPersonaSystemPrompt,
  fetchCard: async (cardId: string): Promise<CardMeta | null> => {
    const row = await db('cards')
      .where({ id: cardId })
      .select('id', 'title', 'description')
      .first();
    if (!row) return null;
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
    };
  },
  fetchRecentUserMessages: async (sessionId: string): Promise<CardChatMessage[]> => {
    const rows = await db('card_chat_messages')
      .where({ session_id: sessionId })
      .where('role', 'user')
      .orderBy('created_at', 'desc')
      .limit(RECENT_USER_MESSAGES_LIMIT)
      .select('*');
    return (rows as CardChatMessage[]).reverse();
  },
  fetchSession: async (sessionId: string, cardId: string): Promise<CardChatSession | null> => {
    const row = await db('card_chat_sessions').where({ id: sessionId, card_id: cardId }).first();
    return (row as CardChatSession | undefined) ?? null;
  },
  updateSession: async (
    sessionId: string,
    updates: { status?: CardChatSessionStatus; quality_score?: number | null }
  ): Promise<void> => {
    const now = new Date().toISOString();
    await db('card_chat_sessions')
      .where({ id: sessionId })
      .update({ ...updates, updated_at: now });
  },
  /**
   * [why] Update the card description with AI-refined requirements.
   * Appends an "## AI-Refined Requirements" block to the existing
   * description so the original author content is preserved.
   */
  updateCardDescription: async (cardId: string, block: string): Promise<void> => {
    if (!block) return;
    const card = await db('cards').where({ id: cardId }).select('description').first();
    if (!card) return;

    const existing = (card.description as string | null) ?? '';
    // [why] Replace any existing AI-Refined Requirements block so repeated
    // refine calls don't keep appending duplicate content.
    const aiBlockStart = existing.indexOf('## AI-Refined Requirements');
    const cleanExisting =
      aiBlockStart >= 0 ? existing.substring(0, aiBlockStart).trimEnd() : existing;

    const newDescription = cleanExisting ? `${cleanExisting}\n\n${block}` : block;

    await db('cards').where({ id: cardId }).update({
      description: newDescription,
      updated_at: new Date().toISOString(),
    });
  },
};

/**
 * Run one turn of the BA persona goal loop:
 * 1. Determine which category to ask about next
 * 2. Send the conversation to the AI provider
 * 3. Score the quality of the assistant's response
 * 4. Persist the assistant message
 * 5. Emit activity events
 */
async function runGoalLoopTurn(
  ctx: GoalLoopContext,
  conversationHistory: CardChatProviderMessage[],
  userMessages: string[],
  previousTurns: ConversationTurn[]
): Promise<ConversationTurn> {
  const coveredCategories = goalLoopDeps.detectCoveredCategories(userMessages);
  const category = goalLoopDeps.selectNextQuestionCategory(coveredCategories);
  const question = goalLoopDeps.buildCategoryQuestion(category);

  // [why] Add the framing question as a system message so the AI knows
  // exactly which category to focus on this turn without the user seeing it.
  const messages: CardChatProviderMessage[] = [
    ...conversationHistory,
    {
      role: 'system',
      content: `Focus on "${category.replace(/_/g, ' ')}". Ask the user: "${question}"`,
    },
  ];

  const completion = await goalLoopDeps.requestCardChatCompletion({ messages });
  if (completion.status !== 200 || !completion.data) {
    throw new Error(completion.message ?? completion.name ?? 'ai-provider-error');
  }

  // [why] Compute quality score from the assistant's response + all user
  // answers collected so far. This reflects the cumulative refinement depth.
  const allUserContent = userMessages.map((m) => m).join('\n');
  const score = goalLoopDeps.computeQualityScore({
    assistantContent: completion.data.message,
    allUserContent,
  });

  // Persist the assistant message
  const writeResult = await goalLoopDeps.writeCardChatMessage({
    sessionId: ctx.session.id,
    cardId: ctx.card.id,
    authorId: ctx.userId,
    role: 'assistant',
    content: completion.data.message,
  });

  return {
    assistantMessage: writeResult.data.message,
    category,
    score,
  };
}

/**
 * Run the full BA persona goal loop for a card-chat session.
 *
 * [why] This is the main entry point called by the /refine API.
 * It runs up to MAX_REFINEMENT_TURNS of targeted questioning,
 * scoring after each turn, and transitions the session to
 * READY_FOR_REVIEW when the quality threshold is met.
 */
export async function runGoalLoop({
  sessionId,
  cardId,
  userId,
}: RefineCardChatInput): Promise<RefineCardChatResult> {
  // Validate session
  const session = await goalLoopDeps.fetchSession(sessionId, cardId);
  if (!session) {
    return {
      status: 404,
      name: 'session-not-found',
      message: 'No chat session found for this card',
    };
  }

  if (session.status !== 'ACTIVE_REFINEMENT') {
    return {
      status: 409,
      name: 'session-not-active',
      message: 'Session must be in ACTIVE_REFINEMENT state to run refinement',
    };
  }

  // Fetch card metadata
  const card = await goalLoopDeps.fetchCard(cardId);
  if (!card) {
    return {
      status: 404,
      name: 'card-not-found',
      message: 'Card not found',
    };
  }

  // Emit started event
  await goalLoopDeps.emitCardChatActivity({
    type: 'card_ai_assist_started',
    cardId,
    sessionId,
    actorId: userId,
    payload: { cardTitle: card.title },
  });

  // Build conversation history
  const recentUserMessages = await goalLoopDeps.fetchRecentUserMessages(sessionId);
  const systemPrompt = goalLoopDeps.buildBAPersonaSystemPrompt({
    cardTitle: card.title,
    cardDescription: card.description ?? '',
  });

  const conversationHistory: CardChatProviderMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // [why] Include recent user messages as context so the AI builds on
  // prior answers rather than asking redundant questions.
  for (const msg of recentUserMessages) {
    conversationHistory.push({ role: 'user', content: msg.content });
  }

  const ctx: GoalLoopContext = { session, card, userId };
  const userContents = recentUserMessages.map((m) => m.content);
  const turns: ConversationTurn[] = [];

  let lastTurn: ConversationTurn | null = null;

  for (let i = 0; i < MAX_REFINEMENT_TURNS; i++) {
    try {
      const turn = await runGoalLoopTurn(ctx, conversationHistory, userContents, turns);
      turns.push(turn);
      lastTurn = turn;

      // Emit question asked event
      await goalLoopDeps.emitCardChatActivity({
        type: 'card_ai_question_asked',
        cardId,
        sessionId,
        actorId: userId,
        payload: {
          category: turn.category,
          turnIndex: i + 1,
        },
      });

      // Emit quality scored event
      await goalLoopDeps.emitCardChatActivity({
        type: 'card_ai_quality_scored',
        cardId,
        sessionId,
        actorId: userId,
        payload: {
          score: turn.score,
          turnIndex: i + 1,
        },
      });

      // Update stored quality score
      await goalLoopDeps.updateSession(sessionId, {
        quality_score: turn.score.total,
      });

      // Check stop condition
      if (turn.score.total >= QUALITY_THRESHOLD) {
        await goalLoopDeps.updateSession(sessionId, {
          status: 'READY_FOR_REVIEW',
          quality_score: turn.score.total,
        });

        await goalLoopDeps.emitCardChatActivity({
          type: 'card_ai_assist_ready_for_review',
          cardId,
          sessionId,
          actorId: userId,
          payload: {
            finalScore: turn.score,
            totalTurns: turns.length,
          },
        });

        // [why] Try to extract structured fields from the conversation history
        // and update the card description when the loop completes successfully.
        await tryUpdateCardDescription(cardId, turn.assistantMessage!.content, turn.score.total);

        const updatedSession = await goalLoopDeps.fetchSession(sessionId, cardId);
        return {
          status: 200,
          data: {
            session: updatedSession!,
            assistantMessage: turn.assistantMessage!,
            qualityScore: turn.score,
            loopComplete: true,
          },
        };
      }

      // [why] If the AI gave a summary-style response (all categories covered),
      // but the score is still below threshold, push the assistant to ask a
      // more specific follow-up question for the weakest category.
      const weakestCategory = findWeakestCategory(turn.score);
      conversationHistory.push({
        role: 'assistant',
        content: turn.assistantMessage!.content,
      });
      conversationHistory.push({
        role: 'system',
        content: `The quality score is ${turn.score.total}/100 (threshold: ${QUALITY_THRESHOLD}). Focus on improving "${weakestCategory}" in your next question.`,
      });
    } catch (error) {
      console.error(
        '[cardChat/goalLoop] Turn failed:',
        error instanceof Error ? error.message : String(error)
      );
      // [why] If a single turn fails (e.g. provider timeout), return what we have
      // so far rather than losing all progress.
      break;
    }
  }

  // [why] Exhausted all turns without reaching threshold — return the last
  // turn's result so the UI can show current score and partial progress.
  if (lastTurn) {
    // [why] Even though we didn't hit the threshold, try to extract any
    // structured content gathered so far — partial extraction is better than none.
    await tryUpdateCardDescription(
      cardId,
      lastTurn.assistantMessage!.content,
      lastTurn.score.total
    );

    const updatedSession = await goalLoopDeps.fetchSession(sessionId, cardId);
    return {
      status: 200,
      data: {
        session: updatedSession!,
        assistantMessage: lastTurn.assistantMessage!,
        qualityScore: lastTurn.score,
        loopComplete: false,
      },
    };
  }

  // No turns completed at all (should not happen with valid session)
  return {
    status: 500,
    name: 'refinement-failed',
    message: 'Refinement loop produced no results',
  };
}

function findWeakestCategory(score: QualityScoreBreakdown): string {
  const dimensions: Array<[string, number]> = [
    ['ears coverage', score.earsCoverage],
    ['acceptance criteria', score.acceptanceCriteria],
    ['constraint clarity', score.constraintClarity],
    ['testability', score.testability],
  ];
  dimensions.sort((a, b) => a[1] - b[1]);
  return dimensions[0]![0];
}

/**
 * [why] Attempt to extract structured fields from the latest assistant
 * response and append them to the card description. This is best-effort —
 * if extraction yields nothing, the card is left unchanged.
 */
async function tryUpdateCardDescription(
  cardId: string,
  assistantContent: string,
  score: number
): Promise<void> {
  try {
    const fields = extractStructuredFields(assistantContent);
    if (hasAnyStructuredContent(fields)) {
      const block = formatStructuredBlock(fields, score);
      await goalLoopDeps.updateCardDescription(cardId, block);
    }
  } catch (err) {
    // [why] Extraction is best-effort — don't fail the whole refinement
    // loop if the card update fails. Log and continue.
    console.error(
      '[cardChat/goalLoop] Card description update failed:',
      err instanceof Error ? err.message : String(err)
    );
  }
}
