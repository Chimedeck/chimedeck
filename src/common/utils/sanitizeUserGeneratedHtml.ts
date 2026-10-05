const DISALLOWED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
]);

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'formaction', 'poster']);

function isSafeDataImageUri(value: string): boolean {
  return /^data:image\/(?:png|gif|jpe?g|webp|svg\+xml);/i.test(value.trim());
}

function isSafeUrl(value: string, attrName: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return true;
  }

  if (trimmed.startsWith('//')) return true;

  const compact = trimmed
    .toLowerCase()
    .replaceAll(/[\u0000-\u001F\u007F]+/g, '')
    .replaceAll(/\s+/g, '');
  if (compact.startsWith('javascript:') || compact.startsWith('vbscript:')) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, globalThis.location?.origin ?? 'http://localhost');
  } catch {
    return false;
  }

  if (attrName === 'href' || attrName === 'xlink:href' || attrName === 'formaction') {
    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:' ||
      parsed.protocol === 'tel:'
    );
  }

  if (attrName === 'src' || attrName === 'poster') {
    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'blob:' ||
      (parsed.protocol === 'data:' && isSafeDataImageUri(trimmed))
    );
  }

  return true;
}

export function sanitizeUserGeneratedHtml(html: string): string {
  if (!html) return '';

  if (typeof DOMParser === 'undefined') {
    return html
      .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = Array.from(doc.body.querySelectorAll('*'));

  elements.forEach((el) => {
    if (!el.isConnected) return;

    const tagName = el.tagName.toLowerCase();
    if (DISALLOWED_TAGS.has(tagName)) {
      // [why] Keep dangerous HTML visible to users as plain text so content is
      // not silently lost, while still preventing execution in the DOM.
      el.replaceWith(doc.createTextNode(el.outerHTML));
      return;
    }

    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      const name = attr.name.toLowerCase();

      if (name.startsWith('on') || name === 'style' || name === 'srcdoc') {
        el.removeAttribute(attr.name);
        return;
      }

      if (URL_ATTRS.has(name) && !isSafeUrl(attr.value, name)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}
