// Structured extraction from BA persona assistant responses.
// Parses assistant messages for labeled sections corresponding to the
// four goal-loop categories, returning a markdown block suitable for
// appending to the card description field.
//
// [why] The goal loop runs purely in the chat — without this step, the
// structured requirement output never lands on the card itself. This
// bridges the gap between conversational refinement and persistent
// card fields.

export interface CardRequirementFields {
  business_value: string | null;
  ears_requirements: string | null;
  acceptance_criteria: string | null;
  constraints: string | null;
}

// [why] Each category uses a regex that anchors on a markdown heading
// pattern.  The regexes are lenient about heading level (## vs ###) and
// trailing punctuation so they survive minor prompt-drift from the AI.
const EXTRACTION_PATTERNS: Record<keyof CardRequirementFields, RegExp[]> = {
  business_value: [
    /\*\*Business\s+Value\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
    /\*\*Business\s+Outcome\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
    /\*\*Problem\s+Statement\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
  ],
  ears_requirements: [
    /\*\*EARS\s+Requirements?\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
    /\*\*Requirements?\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
    /\*\*Requirement\s+Statements?\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
  ],
  acceptance_criteria: [
    /\*\*Acceptance\s+Criteria\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
    /\*\*Test\s+Scenarios?\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
  ],
  constraints: [
    /\*\*Constraints?\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
    /\*\*Non-?Goals?\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
    /\*\*Assumptions?\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
    /\*\*Dependencies?\*\*[:]*\s*\n([\s\S]*?)(?=\n\*\*|\n###|\n##|$)/i,
  ],
};

/**
 * Extract structured requirement fields from an assistant message.
 * Returns null for any field that could not be parsed.
 *
 * [why] We return an object with explicit nulls rather than omitting keys
 * so callers can easily check which categories were found vs. not found.
 */
export function extractStructuredFields(responseText: string): CardRequirementFields {
  const result: CardRequirementFields = {
    business_value: null,
    ears_requirements: null,
    acceptance_criteria: null,
    constraints: null,
  };

  for (const [key, patterns] of Object.entries(EXTRACTION_PATTERNS)) {
    for (const pattern of patterns) {
      const match = (pattern).exec(responseText);
      if (match?.[1]) {
        const extracted = match[1].trim();
        // [why] Skip false positives where the heading exists but the
        // content is basically empty (just a line break or a single word).
        if (extracted.length > 3) {
          result[key as keyof CardRequirementFields] = extracted;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Check whether a response text contains any substantive structured content.
 */
export function hasAnyStructuredContent(fields: CardRequirementFields): boolean {
  return Object.values(fields).some((v) => v !== null);
}

/**
 * Format extracted fields into a markdown block suitable for appending
 * to a card's description field.
 *
 * [why] We wrap the block in an "## AI-Refined Requirements" heading so
 * the card description stays human-readable and clearly demarcates which
 * content came from the AI assistant vs. the original author.
 */
export function formatStructuredBlock(
  fields: CardRequirementFields,
  score: number,
): string {
  const sections: string[] = [];

  if (fields.business_value) {
    sections.push(`### Business Value\n${fields.business_value}`);
  }
  if (fields.ears_requirements) {
    sections.push(`### EARS Requirements\n${fields.ears_requirements}`);
  }
  if (fields.acceptance_criteria) {
    sections.push(`### Acceptance Criteria\n${fields.acceptance_criteria}`);
  }
  if (fields.constraints) {
    sections.push(`### Constraints & Non-Goals\n${fields.constraints}`);
  }

  if (sections.length === 0) return '';

  const header = `## AI-Refined Requirements\n_Quality score: ${score}/100 — last updated ${new Date().toISOString()}_`;
  return [header, '', ...sections].join('\n');
}
