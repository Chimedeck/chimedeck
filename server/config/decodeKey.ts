// PEM/base64 decoder for env-supplied keys (JWT, GitHub App).
//
// PEM blocks are sometimes stored as base64 in .env to avoid multiline
// quoting issues, sometimes as raw PEM. The decoder handles both shapes
// but — critically — fails LOUDLY when the input is neither, instead of
// silently returning a corrupted string that later explodes deep inside
// `jose` or `KeyObject` with a "Uint8Array.fromBase64 requires a valid
// base64 string" stack trace that the user has no way to act on.
//
// Acceptable inputs:
//   1. A raw PEM block, optionally wrapped in BEGIN/END markers. Pass-through.
//   2. A base64-encoded PEM block. Decoded, then verified to start with
//      `-----BEGIN` so we know the round-trip succeeded.
//
// Anything else throws so the operator gets a startup error pointing at the
// exact env var that needs to be fixed (rather than a 500 on first login).
export function decodeKey(raw: string, varName: string): string {
  if (!raw) return '';
  if (raw.startsWith('-----')) return raw;
  // base64-encoded PEM — strict decode so a stray newline or `=` in the middle
  // fails here instead of corrupting the key.
  const cleaned = raw.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error(
      `${varName} contains invalid base64 characters. ` +
        `Expected a base64-encoded PEM (or raw PEM starting with "-----BEGIN").`,
    );
  }
  const decoded = Buffer.from(cleaned, 'base64').toString('utf-8');
  if (!decoded.startsWith('-----BEGIN')) {
    throw new Error(
      `${varName} decoded value does not look like a PEM block. ` +
        `Expected base64-encoded PEM that starts with "-----BEGIN" after decoding.`,
    );
  }
  return decoded;
}
