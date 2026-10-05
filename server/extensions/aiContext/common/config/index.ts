// Central config for aiContext extension (Sprint 174).
// [why] All env vars, limits, and provider settings are read here so the full
// configuration surface is visible in one place.
export const AI_CONTEXT_FLAG_KEY = 'AI_CONTEXT_ENABLED';

// [why] Restrict search to these paths only — prevents exfiltration
// of sensitive files like .env, credentials, or unrelated codebases.
export const PATH_ALLOWLIST = [
  'specs/**/*.md',
  'specs/architecture/',
  'specs/changelog/',
  'specs/sprints/',
  'specs/security/',
  'src/**',
  'server/**',
] as const;

// [why] Each connector gets a budget to prevent runaway searches.
export const CONNECTOR_TIMEOUT_MS = 5000;
export const MAX_CHUNKS_PER_CONNECTOR = 10;
export const MAX_TOTAL_CHUNKS = 40;

// [why] Large files can stall the event loop — truncate and note in metadata.
export const MAX_FILE_SIZE_BYTES = 100_000; // 100 KB

// [why] Git log depth for gitSearch connector.
export const GIT_LOG_DEPTH = 50;

// [why] Similarity threshold for cardsSearch ILIKE matching.
export const CARD_SIMILARITY_THRESHOLD = 0.3;
