// BA persona prompt templates for the card-chat refinement loop.
// Provides the system prompt and question-category templates used
// by the goal loop engine to guide the AI through structured
// requirement discovery.

import type { GoalQuestionCategory } from '../../types';

// [why] The BA persona is a specific character the AI adopts to stay
// focused on requirement elicitation, not premature solution design.
const BA_SYSTEM_PROMPT = [
  'You are a Business Analyst (BA) assistant helping to refine a feature requirement.',
  'Your role is to ask targeted questions that help the user clarify:',
  '- Business value and expected outcomes',
  '- EARS-style requirement statements (Ubiquitous, Event-Driven, State-Driven, Optional)',
  '- Acceptance criteria with positive paths, negative paths, and edge cases',
  '- Constraints, assumptions, dependencies, and non-goals',
  '',
  'Guidelines:',
  '- Ask one question at a time. Be specific and actionable.',
  '- When the user answers, acknowledge their input and ask the next logical question.',
  '- Once all categories are covered, synthesize everything into a structured summary.',
  '- Do NOT propose solutions or implementation details — stay in requirement space.',
  '- Do NOT mark the requirement as complete prematurely. Only conclude when all',
  '  four categories (business value, EARS requirements, acceptance criteria, constraints)',
  '  have substantive answers.',
].join('\n');

// [why] Category-specific question templates give the AI a starting point
// for each refinement phase. The AI adapts these based on the user's answers.
const CATEGORY_QUESTIONS: Record<GoalQuestionCategory, string[]> = {
  business_value: [
    'What problem does this feature solve for users?',
    'What is the primary business outcome you expect from this?',
    'Who are the key stakeholders and how will they measure success?',
    'What would happen if we did NOT build this feature?',
  ],
  ears_requirements: [
    'Can you state this as a Ubiquitous requirement? ("The system shall...")',
    'Are there any Event-Driven behaviors? ("When X happens, the system shall Y...")',
    'Are there State-Driven constraints? ("While X is true, the system shall Y...")',
    'What optional behaviors might vary by deployment or configuration?',
  ],
  acceptance_criteria: [
    'What specific test scenarios prove this requirement is met?',
    'What negative paths should we verify? (e.g., error states, edge cases)',
    'What are the preconditions for each scenario? (Given/When/Then)',
    'How would a QA engineer know this feature works correctly?',
  ],
  constraints: [
    'What constraints exist? (technical, regulatory, UX, performance)',
    'What assumptions are you making about the implementation environment?',
    'What is explicitly OUT of scope for this requirement?',
    'What dependencies does this feature have on other systems or teams?',
  ],
};

/**
 * Build the system prompt for the BA persona refinement loop.
 * Includes card-level context so the AI understands what card
 * this refinement is about.
 */
export function buildBAPersonaSystemPrompt({
  cardTitle,
  cardDescription,
}: {
  cardTitle: string;
  cardDescription: string;
}): string {
  const cardContext = [
    '',
    'Card context:',
    `Title: ${cardTitle}`,
    `Current description: ${cardDescription || '(empty)'}`,
    '',
    'Use this as the starting point for refinement. Ask questions to fill gaps.',
  ].join('\n');

  return `${BA_SYSTEM_PROMPT}\n${cardContext}`;
}

/**
 * Determine which question category to focus on next based on which
 * categories have already been covered in the conversation.
 *
 * [why] Simple round-robin with skip-if-sufficient logic. We don't need
 * an LLM to pick the category — determinism keeps the loop predictable.
 */
export function selectNextQuestionCategory(
  coveredCategories: Set<GoalQuestionCategory>
): GoalQuestionCategory {
  const order: GoalQuestionCategory[] = [
    'business_value',
    'ears_requirements',
    'acceptance_criteria',
    'constraints',
  ];

  for (const category of order) {
    if (!coveredCategories.has(category)) return category;
  }

  // All covered — cycle back to the first for deeper refinement
  return 'business_value';
}

/**
 * Build the next user-facing question for the given category.
 * Returns the first question from the category's template list.
 * In a future iteration this could vary questions based on context.
 */
export function buildCategoryQuestion(category: GoalQuestionCategory): string {
  const questions = CATEGORY_QUESTIONS[category];
  // [why] Always use the first question — the AI adapts follow-ups naturally
  // based on the conversation context.
  return questions[0] ?? 'Can you tell me more about this?';
}

/**
 * Determine which categories have been covered based on the conversation
 * history. Uses the same signal patterns as the quality score to detect
 * category-specific content in user messages.
 */
const CATEGORY_SIGNALS: Record<GoalQuestionCategory, RegExp> = {
  business_value: /\b(business\s+value|outcome|stakeholder|success|roi|benefit|problem)\b/i,
  ears_requirements:
    /\b(system\s+shall|while|when|event.driven|state.driven|ubiquitous|optional)\b/i,
  acceptance_criteria: /\b(given\b|\bthen\b|\bwhen\b.*\bthen\b|scenario|test\s+case|acceptance)\b/i,
  constraints:
    /\b(constraint|assumption|non.goal|out\s+of\s+scope|limitation|dependency|depends\s+on)\b/i,
};

export function detectCoveredCategories(userMessages: string[]): Set<GoalQuestionCategory> {
  const covered = new Set<GoalQuestionCategory>();
  const combined = userMessages.join(' ');

  for (const [category, signal] of Object.entries(CATEGORY_SIGNALS)) {
    if (signal.test(combined)) {
      covered.add(category as GoalQuestionCategory);
    }
  }

  return covered;
}
