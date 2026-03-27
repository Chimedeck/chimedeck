// printCard — generates a print-ready HTML page in a new window for a card.
// Opens window.print() automatically once the content is rendered.
import { marked } from 'marked';
import type { Card, Checklist } from '../api';
import type { Attachment } from '~/extensions/Attachments/types';

interface PrintCardOptions {
  card: Card;
  listTitle: string;
  boardTitle: string;
  checklists: Checklist[];
  attachments: Attachment[];
}

function escHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function renderDescription(markdown: string | null): string {
  if (!markdown?.trim()) return '';
  const html = marked.parse(markdown) as string;
  return `
    <section class="section">
      <h2 class="section-title">Description</h2>
      <div class="description prose">${html}</div>
    </section>`;
}

function renderLabels(labels: Card['labels']): string {
  if (!labels?.length) return '';
  const chips = labels
    .map(
      (l) =>
        `<span class="label" style="background:${escHtml(l.color)}">${escHtml(l.name)}</span>`,
    )
    .join('');
  return `<div class="labels">${chips}</div>`;
}

function renderChecklists(checklists: Checklist[]): string {
  if (!checklists.length) return '';
  const sections = checklists
    .map((cl) => {
      const done = cl.items.filter((i) => i.checked).length;
      const total = cl.items.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const items = cl.items
        .map(
          (item) =>
            `<li class="checklist-item ${item.checked ? 'checked' : ''}">
              <span class="checkbox">${item.checked ? '&#10003;' : '&nbsp;'}</span>
              <span class="item-text">${escHtml(item.title)}</span>
            </li>`,
        )
        .join('');
      return `
        <div class="checklist">
          <div class="checklist-header">
            <strong>${escHtml(cl.title)}</strong>
            <span class="checklist-progress">${done}/${total} &mdash; ${pct}%</span>
          </div>
          <ul>${items}</ul>
        </div>`;
    })
    .join('');
  return `
    <section class="section">
      <h2 class="section-title">Checklists</h2>
      ${sections}
    </section>`;
}

function renderAttachments(attachments: Attachment[]): string {
  if (!attachments.length) return '';

  const fileAttachments = attachments.filter((a) => a.type === 'FILE');
  const linkAttachments = attachments.filter(
    (a) => a.type === 'URL' && !a.referenced_card_id,
  );
  const cardLinks = attachments.filter((a) => a.type === 'URL' && a.referenced_card_id);

  const rows: string[] = [];

  for (const a of fileAttachments) {
    const name = a.alias ?? a.name;
    const date = formatDate(a.created_at);
    const thumb = a.thumbnail_url
      ? `<img src="${escHtml(a.thumbnail_url)}" class="thumb" alt="" />`
      : `<span class="thumb no-thumb"></span>`;
    rows.push(`<li class="attachment-row">${thumb}<div class="attachment-info"><strong>${escHtml(name)}</strong><span class="attachment-meta">Added ${date}</span></div></li>`);
  }

  for (const a of linkAttachments) {
    const name = a.alias ?? a.name;
    const url = a.external_url ?? '';
    const date = formatDate(a.created_at);
    rows.push(`<li class="attachment-row"><span class="thumb link-thumb">&#128279;</span><div class="attachment-info"><strong>${escHtml(name)}</strong><a href="${escHtml(url)}" class="attachment-url">${escHtml(url)}</a><span class="attachment-meta">Added ${date}</span></div></li>`);
  }

  for (const a of cardLinks) {
    const linkedCard = a.referenced_card;
    const date = formatDate(a.created_at);
    const title = linkedCard?.title ?? a.alias ?? a.name;
    let boardBreadcrumb = '';
    if (linkedCard?.board_name) {
      boardBreadcrumb = linkedCard.list_name
        ? `${linkedCard.board_name} › ${linkedCard.list_name}`
        : linkedCard.board_name;
    }
    const boardSpan = boardBreadcrumb
      ? `<span class="attachment-meta">${escHtml(boardBreadcrumb)}</span>`
      : '';
    rows.push(`<li class="attachment-row"><span class="thumb card-thumb">&#9001;</span><div class="attachment-info"><strong>${escHtml(title)}</strong>${boardSpan}<span class="attachment-meta">Added ${date}</span></div></li>`);
  }

  return `
    <section class="section">
      <h2 class="section-title">Attachments</h2>
      <ul class="attachment-list">${rows.join('')}</ul>
    </section>`;
}

export function printCard({
  card,
  listTitle,
  boardTitle,
  checklists,
  attachments,
}: PrintCardOptions): void {
  const labels = card.labels ?? [];
  const members = card.members ?? [];

  const membersHtml = members.length
    ? `<div class="meta-row"><span class="meta-label">Members</span> ${members.map((m) => escHtml(m.name ?? m.email)).join(', ')}</div>`
    : '';

  const datesHtml = (() => {
    const parts: string[] = [];
    if (card.start_date) parts.push(`Start: ${formatDate(card.start_date)}`);
    if (card.due_date) {
      const done = card.due_complete ? ' ✓' : '';
      parts.push(`Due: ${formatDate(card.due_date)}${done}`);
    }
    return parts.length
      ? `<div class="meta-row"><span class="meta-label">Dates</span> ${parts.join(' &nbsp;·&nbsp; ')}</div>`
      : '';
  })();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(card.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 32px 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .breadcrumb {
      font-size: 12px;
      color: #666;
      margin-bottom: 12px;
    }
    .card-title {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }
    .card-title-circle {
      width: 18px;
      height: 18px;
      border: 2px solid #555;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.3;
      color: #111;
    }
    .labels {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }
    .label {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      letter-spacing: 0.3px;
    }
    .meta-row {
      font-size: 12px;
      color: #555;
      margin-bottom: 4px;
    }
    .meta-label {
      font-weight: 600;
      margin-right: 6px;
      color: #333;
    }
    .section {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .description.prose { font-size: 14px; line-height: 1.7; }
    .description.prose h1, .description.prose h2, .description.prose h3 {
      margin: 12px 0 6px; font-weight: 700;
    }
    .description.prose p { margin-bottom: 10px; }
    .description.prose ul, .description.prose ol { margin: 0 0 10px 20px; }
    .description.prose li { margin-bottom: 4px; }
    .description.prose code {
      background: #f3f4f6; border-radius: 4px; padding: 1px 5px;
      font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px;
    }
    .description.prose pre {
      background: #f3f4f6; border-radius: 6px; padding: 12px;
      overflow-x: auto; margin-bottom: 12px;
    }
    .description.prose pre code { background: none; padding: 0; }
    .description.prose blockquote {
      border-left: 3px solid #d1d5db; margin: 0; padding-left: 14px; color: #555;
    }
    .description.prose a { color: #2563eb; }
    /* Checklists */
    .checklist { margin-bottom: 16px; }
    .checklist-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }
    .checklist-progress { font-size: 12px; color: #888; }
    .checklist ul { list-style: none; padding: 0; }
    .checklist-item {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 3px 0; font-size: 13px;
    }
    .checklist-item.checked .item-text {
      text-decoration: line-through; color: #9ca3af;
    }
    .checkbox {
      width: 16px; height: 16px; border: 1.5px solid #9ca3af;
      border-radius: 3px; display: flex; align-items: center; justify-content: center;
      font-size: 10px; flex-shrink: 0; margin-top: 2px;
      color: #374151;
    }
    .checklist-item.checked .checkbox {
      background: #374151; border-color: #374151; color: #fff;
    }
    /* Attachments */
    .attachment-list { list-style: none; padding: 0; }
    .attachment-row {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 8px 0; border-bottom: 1px solid #f3f4f6;
    }
    .attachment-row:last-child { border-bottom: none; }
    .thumb {
      width: 60px; height: 44px; object-fit: cover; border-radius: 4px;
      background: #e5e7eb; flex-shrink: 0;
    }
    .no-thumb { display: block; }
    .link-thumb, .card-thumb {
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; background: #f3f4f6;
    }
    .attachment-info { display: flex; flex-direction: column; gap: 2px; }
    .attachment-url { font-size: 11px; color: #2563eb; word-break: break-all; }
    .attachment-meta { font-size: 11px; color: #9ca3af; }
    /* Print */
    @media print {
      body { padding: 32px 40px; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="breadcrumb">${escHtml(boardTitle)} &rsaquo; ${escHtml(listTitle)}</div>
  <div class="card-title">
    <span class="card-title-circle"></span>
    <h1>${escHtml(card.title)}</h1>
  </div>
  ${renderLabels(labels)}
  ${membersHtml}
  ${datesHtml}
  ${renderDescription(card.description)}
  ${renderChecklists(checklists)}
  ${renderAttachments(attachments)}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // [why] window.open + window.print() is unreliable on mobile (popups blocked,
  // print API unsupported). On touch devices we fall back to a direct download —
  // the user opens the file in their browser and uses the native share/print sheet.
  const isMobile = navigator.maxTouchPoints > 0;

  if (isMobile) {
    const a = document.createElement('a');
    const safeName = card.title.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `${safeName}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } else {
    window.open(url, '_blank', 'width=900,height=700');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
