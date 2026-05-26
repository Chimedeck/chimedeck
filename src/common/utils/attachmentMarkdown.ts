import type { Attachment } from '~/extensions/Attachments/types';

const ATTACHMENT_URL_PREFIX = 'attachment:';
const MARKDOWN_TARGET_PATTERN = /(!?)\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g;
const ATTACHMENT_PLACEHOLDER_URL_RE = /attachment:[^)\s"'<>]+(?:\)[^)\s"'<>]+)*/g;

interface MarkdownTargetParts {
  bang: string;
  label: string;
  href: string;
  title: string | undefined;
}

function replaceMarkdownTargets(
  markdown: string,
  replacer: (parts: MarkdownTargetParts) => string | null,
): string {
  return markdown.replaceAll(MARKDOWN_TARGET_PATTERN, (full, bang, label, href, title) => {
    const nextHref = replacer({
      bang,
      label,
      href,
      title: typeof title === 'string' ? title : undefined,
    });
    if (!nextHref || nextHref === href) return full;
    const titlePart = typeof title === 'string' && title.length > 0 ? ` "${title}"` : '';
    return `${bang}[${label}](${nextHref}${titlePart})`;
  });
}

function buildAttachmentNameMap(attachments: Attachment[]): Map<string, Attachment> {
  const attachmentMap = new Map<string, Attachment>();
  attachments.forEach((attachment) => {
    if (!attachmentMap.has(attachment.name)) {
      attachmentMap.set(attachment.name, attachment);
    }
  });
  return attachmentMap;
}

function normalizeAttachmentPlaceholderHrefEncoding(content: string): string {
  if (!content || !hasAttachmentPlaceholder(content)) return content;

  // [why] Legacy placeholder urls may contain raw parentheses because encodeURIComponent
  // does not escape them. Markdown parsers can misread these and drop surrounding text.
  return content.replaceAll(ATTACHMENT_PLACEHOLDER_URL_RE, (href) => (
    href.replaceAll('(', '%28').replaceAll(')', '%29')
  ));
}

// [why] Some editor paths can persist HTML with src="attachment:..." rather than
// markdown image/link syntax. This pass resolves raw placeholder URLs anywhere in
// content so previews do not render broken image placeholders.
export function hydrateAttachmentPlaceholderUrls(content: string, attachments: Attachment[]): string {
  if (!content || attachments.length === 0 || !hasAttachmentPlaceholder(content)) {
    return content;
  }

  const normalized = normalizeAttachmentPlaceholderHrefEncoding(content);
  const attachmentMap = buildAttachmentNameMap(attachments);

  return normalized.replaceAll(ATTACHMENT_PLACEHOLDER_URL_RE, (href) => {
    const name = readAttachmentPlaceholderName(href);
    if (!name) return href;
    const attachment = attachmentMap.get(name);
    if (!attachment) return href;
    return resolveAttachmentMarkdownUrl(attachment, false) ?? href;
  });
}

function buildAttachmentUrlMap(attachments: Attachment[]): Map<string, string> {
  const attachmentMap = new Map<string, string>();

  attachments.forEach((attachment) => {
    if (attachment.type !== 'FILE') return;
    [attachment.url, attachment.thumbnail_url]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .forEach((value) => {
        if (!attachmentMap.has(value)) {
          attachmentMap.set(value, attachment.name);
        }
      });
  });

  return attachmentMap;
}

export function buildAttachmentPlaceholderUrl(name: string): string {
  const encodedName = encodeURIComponent(name)
    .replaceAll('(', '%28')
    .replaceAll(')', '%29');
  return `${ATTACHMENT_URL_PREFIX}${encodedName}`;
}

export function readAttachmentPlaceholderName(value: string): string | null {
  if (!value.startsWith(ATTACHMENT_URL_PREFIX)) return null;
  const encodedName = value.slice(ATTACHMENT_URL_PREFIX.length);
  if (!encodedName) return null;
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
}

export function hasAttachmentPlaceholder(markdown: string): boolean {
  return markdown.includes(ATTACHMENT_URL_PREFIX);
}

export function stripCommentAttachmentPlaceholders(markdown: string): string {
  if (!markdown || !hasAttachmentPlaceholder(markdown)) return markdown;

  const normalized = normalizeAttachmentPlaceholderHrefEncoding(markdown);

  return normalized.replaceAll(MARKDOWN_TARGET_PATTERN, (full, bang, label, href) => {
    const attachmentName = readAttachmentPlaceholderName(href);
    if (!attachmentName) return full;
    const fallbackLabel = label || attachmentName;
    return bang === '!' ? fallbackLabel : `[${fallbackLabel}]`;
  });
}

export function resolveAttachmentMarkdownUrl(attachment: Attachment, isImage: boolean): string | null {
  if (attachment.type === 'URL') {
    return attachment.external_url ?? null;
  }

  // [why] For FILE attachments, always prefer the stable authenticated proxy path
  // (view_url) over any raw presigned S3 URL which may be stale or expose S3 directly.
  if (isImage) {
    return attachment.thumbnail_url ?? attachment.view_url ?? null;
  }

  return attachment.view_url ?? attachment.thumbnail_url ?? null;
}

export function hydrateCommentAttachmentMarkdown(markdown: string, attachments: Attachment[]): string {
  if (!markdown || attachments.length === 0 || !hasAttachmentPlaceholder(markdown)) {
    return markdown;
  }

  const normalized = normalizeAttachmentPlaceholderHrefEncoding(markdown);
  const attachmentMap = buildAttachmentNameMap(attachments);

  const replacedMarkdownTargets = replaceMarkdownTargets(normalized, ({ bang, href }) => {
    const name = readAttachmentPlaceholderName(href);
    if (!name) return null;
    const attachment = attachmentMap.get(name);
    if (!attachment) return null;
    return resolveAttachmentMarkdownUrl(attachment, bang === '!');
  });

  return hydrateAttachmentPlaceholderUrls(replacedMarkdownTargets, attachments);
}

export function dehydrateCommentAttachmentMarkdown(markdown: string, attachments: Attachment[]): string {
  if (!markdown || attachments.length === 0) return markdown;

  const attachmentMap = buildAttachmentUrlMap(attachments);
  const attachmentNameMap = new Map(
    attachments
      .filter((attachment) => attachment.type === 'FILE')
      .map((attachment) => [attachment.name, attachment.name]),
  );

  return replaceMarkdownTargets(markdown, ({ label, href }) => {
    if (readAttachmentPlaceholderName(href)) return href;
    const attachmentName = attachmentMap.get(href) ?? attachmentNameMap.get(label);
    if (!attachmentName) return null;
    return buildAttachmentPlaceholderUrl(attachmentName);
  });
}