// server/common/sanitize.ts
// [why] Centralised sanitization functions prevent XSS by stripping or restricting HTML
//       before any user-supplied string is written to the database.
import sanitizeHtml from 'sanitize-html';

/**
 * Strip ALL HTML tags and attributes from a plain-text field.
 * Use for: card titles, board names/titles, list names, custom field value_text.
 */
export function sanitizeText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
}

/**
 * Strip HTML except for a safe Markdown-rendered subset.
 * Use for: card descriptions, board descriptions, comment content.
 * Allowed tags mirror common Markdown output (headings, emphasis, code, links, lists, etc.)
 * but strip all event-handler attributes and javascript: hrefs.
 */
export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [
      'b', 'i', 'em', 'strong', 'u', 's', 'del',
      'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
      code: ['class'],
      pre: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  });
}
