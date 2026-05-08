import { fetchLinkPreview } from '~/extensions/Attachments/api';

type PreviewData = { title: string; faviconUrl: string };

const previewCache = new Map<string, Promise<PreviewData | null>>();

function getPreview(href: string): Promise<PreviewData | null> {
  const cached = previewCache.get(href);
  if (cached !== undefined) return cached;

  const request = fetchLinkPreview({ url: href })
    .then((res) => ({
      title: res.data.title?.trim() ?? '',
      faviconUrl: res.data.faviconUrl?.trim() ?? '',
    }))
    .catch(() => null);

  previewCache.set(href, request);
  return request;
}

function toAbsoluteHttpUrl(href: string): URL | null {
  try {
    const parsed = new URL(href, globalThis.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function updateAnchorContent(anchor: HTMLAnchorElement, title: string, faviconUrl: string): void {
  const icon = document.createElement('img');
  icon.src = faviconUrl;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  icon.className = 'meta-link-chip__icon';
  icon.loading = 'lazy';
  icon.decoding = 'async';
  icon.referrerPolicy = 'no-referrer';

  const label = document.createElement('span');
  label.className = 'meta-link-chip__label';
  label.textContent = title;

  anchor.textContent = '';
  anchor.append(icon, label);
  anchor.classList.add('meta-link-chip');
}

export async function enrichExternalLinkChips(root: HTMLElement): Promise<void> {
  const anchors = Array.from(root.querySelectorAll('a[href]')) as HTMLAnchorElement[];
  if (anchors.length === 0) return;

  await Promise.all(anchors.map(async (anchor) => {
    if (anchor.dataset.metaChipReady === '1') return;
    if (anchor.querySelector('img')) return;

    const rawHref = anchor.getAttribute('href')?.trim() ?? '';
    const absolute = toAbsoluteHttpUrl(rawHref);
    if (!absolute) return;
    if (absolute.origin === globalThis.location.origin) return;

    anchor.dataset.metaChipReady = '1';

    const fallbackTitle = anchor.textContent?.trim() || absolute.hostname;
    const fallbackFavicon = `${absolute.origin}/favicon.ico`;
    const preview = await getPreview(absolute.toString());
    const title = preview?.title || fallbackTitle;
    const faviconUrl = preview?.faviconUrl || fallbackFavicon;

    updateAnchorContent(anchor, title, faviconUrl);
  }));
}
