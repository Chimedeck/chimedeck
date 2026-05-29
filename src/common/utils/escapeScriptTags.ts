/**
 * Preserve script snippets as visible text by escaping only the script tag
 * delimiters. This prevents HTML execution/sanitizer stripping while keeping
 * the original snippet readable in rendered markdown.
 */
export function escapeScriptTags(input: string): string {
  if (!input) return '';

  return input
    .replaceAll(/<script\b([^>]*)>/gi, (_match, attrs: string) => `&lt;script${attrs}&gt;`)
    .replaceAll(/<\/script>/gi, '&lt;/script&gt;');
}
