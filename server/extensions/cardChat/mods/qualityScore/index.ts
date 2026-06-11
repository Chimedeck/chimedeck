// Deterministic quality scoring for card-chat requirement refinement.
// Scores each dimension 0-25, then subtracts ambiguity penalty (0-10).
// Final score is clamped to 0-100.

import type { QualityScoreBreakdown } from '../../types';

// [why] Keywords that signal EARS-compliant phrasing. More matches = higher coverage.
const EARS_SIGNALS = [
  /\bwhile\b/i,
  /\bwhen\b/i,
  /\bwhere\b/i,
  /\bshall\b/i,
  /\bmust\b/i,
  /\bthe system\b/i,
];

// [why] Keywords that indicate well-structured acceptance criteria.
const AC_SIGNALS = [
  /\bgiven\b/i,
  /\bthen\b/i,
  /\band\b/i,
  /\bscenario\b/i,
  /\bexpected\b/i,
  /\bresult\b/i,
  /\bshould\b/i,
];

// [why] Signals of clear constraint documentation.
const CONSTRAINT_SIGNALS = [
  /\bconstraint\b/i,
  /\bassumption\b/i,
  /\bnon-goal\b/i,
  /\bout of scope\b/i,
  /\blimitation\b/i,
  /\bdependency\b/i,
];

// [why] Signals that the requirement is testable.
const TESTABILITY_SIGNALS = [
  /\btest\b/i,
  /\bverify\b/i,
  /\bvalidate\b/i,
  /\bconfirm\b/i,
  /\bcheck\b/i,
  /\bensure\b/i,
];

// [why] Ambiguity signals — vague phrases that hurt testability.
const AMBIGUITY_SIGNALS = [
  /\bsoon\b/i,
  /\blater\b/i,
  /\bprobably\b/i,
  /\bmaybe\b/i,
  /\bsometimes\b/i,
  /\busually\b/i,
  /\btypically\b/i,
  /\bgenerally\b/i,
  /\bmostly\b/i,
  /\bshould be easy\b/i,
  /\bobvious\b/i,
  /\btrivial\b/i,
  /\bsimple\b/i,
  /\bjust\b/i,
  /\bquick\b/i,
];

interface ScoreDimensionResult {
  score: number;
  maxScore: number;
  hitCount: number;
}

function scoreBySignals(text: string, signals: RegExp[], maxScore: number): ScoreDimensionResult {
  let hitCount = 0;
  for (const signal of signals) {
    if (signal.test(text)) hitCount++;
  }
  // [why] Each unique signal match contributes proportionally to maxScore.
  // Full signal coverage gives maxScore; partial coverage scales linearly.
  const score = Math.round((hitCount / signals.length) * maxScore);
  return { score, maxScore, hitCount };
}

function scoreAmbiguity(text: string, maxPenalty: number): number {
  let penaltyPoints = 0;
  for (const signal of AMBIGUITY_SIGNALS) {
    const matches = text.match(new RegExp(signal.source, 'gi'));
    if (matches) penaltyPoints += matches.length;
  }
  // [why] Each ambiguity match costs 1 point, capped at maxPenalty.
  return Math.min(penaltyPoints, maxPenalty);
}

/**
 * Score the quality of a requirement based on the latest assistant response
 * and all accumulated user answers in the conversation.
 *
 * [why] We score the assistant's latest synthesis against all user-provided
 * content because the assistant builds on prior answers. This rewards users
 * who provide detailed, structured responses across multiple questions.
 */
export function computeQualityScore({
  assistantContent,
  allUserContent,
}: {
  assistantContent: string;
  allUserContent: string;
}): QualityScoreBreakdown {
  // [why] Score assistant output for structural completeness, user content for
  // signals of deep thinking. Both contribute to overall quality.
  const combinedText = `${assistantContent}\n${allUserContent}`;

  const ears = scoreBySignals(combinedText, EARS_SIGNALS, 25);
  const ac = scoreBySignals(combinedText, AC_SIGNALS, 25);
  const constraints = scoreBySignals(combinedText, CONSTRAINT_SIGNALS, 25);
  const testability = scoreBySignals(combinedText, TESTABILITY_SIGNALS, 25);

  // [why] Only penalize ambiguity in the assistant output — user answers may
  // contain casual language that shouldn't drag the score down.
  const ambiguityPenalty = scoreAmbiguity(assistantContent, 10);

  const rawTotal = ears.score + ac.score + constraints.score + testability.score - ambiguityPenalty;
  const total = Math.max(0, Math.min(100, rawTotal));

  return {
    earsCoverage: ears.score,
    acceptanceCriteria: ac.score,
    constraintClarity: constraints.score,
    testability: testability.score,
    ambiguityPenalty,
    total,
  };
}

export const qualityScoreDeps = {
  computeQualityScore,
};

// [why] Threshold at which the refinement loop considers the requirement
// sufficiently mature to transition to READY_FOR_REVIEW.
export const QUALITY_THRESHOLD = 90;
