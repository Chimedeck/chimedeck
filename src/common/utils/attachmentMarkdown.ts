import type { Attachment } from '~/extensions/Attachments/types';

const ATTACHMENT_URL_PREFIX = 'attachment:';
const MARKDOWN_TARGET_PATTERN = /(!?)\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g;

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
  return `${ATTACHMENT_URL_PREFIX}${encodeURIComponent(name)}`;
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

  return markdown.replaceAll(MARKDOWN_TARGET_PATTERN, (full, bang, label, href) => {
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

  const attachmentMap = buildAttachmentNameMap(attachments);

  return replaceMarkdownTargets(markdown, ({ bang, href }) => {
    const name = readAttachmentPlaceholderName(href);
    if (!name) return null;
    const attachment = attachmentMap.get(name);
    if (!attachment) return null;
    return resolveAttachmentMarkdownUrl(attachment, bang === '!');
  });
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