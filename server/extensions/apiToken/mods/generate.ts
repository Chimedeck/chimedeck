// server/extensions/apiToken/mods/generate.ts
// Sprint 101 — Generates cryptographically random API tokens.
// Only { hash, prefix } are persisted; raw is returned once at creation.

/**
 * Generates a cryptographically random API token.
 *
 * Format: `hf_` + 64 lowercase hex chars (32 random bytes)
 * Returns { raw, hash, prefix } — only hash and prefix should be stored.
 */
export async function generateApiToken(): Promise<{
  raw: string;
  hash: string;
  prefix: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const raw = `hf_${hex}`;

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // [why] First 10 chars of raw (e.g. "hf_3a7b9c1d") are stored for display so users
  // can identify their token without ever exposing the full secret.
  const prefix = raw.slice(0, 10);

  return { raw, hash, prefix };
}
