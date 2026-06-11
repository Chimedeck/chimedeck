// Front-matter guard — validates and preserves YAML front-matter in markdown files.
// [why] Specs use YAML front-matter for metadata (title, status, date, etc.).
// The file editor must preserve valid front-matter and reject edits that would
// corrupt it.
import type { FrontMatterGuardResult } from '../../types';

/** Known doc type schemas — keys that must be present for each doc type. */
const KNOWN_DOC_TYPES: Record<string, { required: string[]; optional: string[] }> = {
  // Request changelog entries
  request_changelog: {
    required: ['title', 'date', 'status'],
    optional: ['requestId', 'reviewer', 'tags'],
  },
  // Sprint plan entries
  sprint: {
    required: ['sprint_number', 'title', 'status', 'start_date'],
    optional: ['end_date', 'goal', 'dependencies'],
  },
  // Architecture docs
  architecture: {
    required: ['title', 'last_updated'],
    optional: ['status', 'version', 'author'],
  },
  // Security docs
  security: {
    required: ['title', 'last_updated'],
    optional: ['status', 'risk_level', 'owner'],
  },
};

/**
 * Guess the document type from the file path.
 */
function guessDocType(filePath: string): string | null {
  if (filePath.includes('request_changelog')) return 'request_changelog';
  if (filePath.includes('sprints')) return 'sprint';
  if (filePath.includes('architecture')) return 'architecture';
  if (filePath.includes('security')) return 'security';
  return null;
}

/**
 * Parse YAML-like front-matter delimited by --- lines.
 * [why] Simple parser for the subset of YAML used in specs front-matter —
 * key: value pairs, lists, and nested objects at depth 1.
 */
function parseSimpleYaml(yamlStr: string): Record<string, unknown> | null {
  try {
    const result: Record<string, unknown> = {};
    const lines = yamlStr.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const key = trimmed.slice(0, colonIdx).trim();
      let value: string = trimmed.slice(colonIdx + 1).trim();
      // Strip quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Validate front-matter against the known doc type schema.
 * Returns the validation result with parsed data and original string.
 */
export function validateFrontMatter({
  content,
  filePath,
}: {
  content: string;
  filePath: string;
}): FrontMatterGuardResult {
  // Check for front-matter delimiters
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    // No front-matter — this is valid for new files
    return {
      valid: true,
      parsed: {},
      original: '',
    };
  }

  const fmContent = fmMatch[1];
  const parsed = parseSimpleYaml(fmContent);

  if (!parsed) {
    return {
      valid: false,
      original: fmMatch[0],
      reason: 'Failed to parse YAML front-matter — check syntax',
    };
  }

  // Validate against known doc type schema
  const docType = guessDocType(filePath);
  if (docType && KNOWN_DOC_TYPES[docType]) {
    const schema = KNOWN_DOC_TYPES[docType];
    const missingRequired = schema.required.filter(key => !(key in parsed));
    if (missingRequired.length > 0) {
      return {
        valid: false,
        parsed,
        original: fmMatch[0],
        reason: `Missing required fields for ${docType}: [${missingRequired.join(', ')}]`,
      };
    }
  }

  return {
    valid: true,
    parsed,
    original: fmMatch[0],
  };
}
