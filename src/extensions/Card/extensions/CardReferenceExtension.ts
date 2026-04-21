// Tiptap inline atom node for card-URL references.
// When the user pastes a card URL (e.g. /c/{id}) it renders
// as a card chip showing the card title and list status instead of a raw link.
// The chip can be selected (click / arrow keys) and a BubbleMenu appears.
import { Node, mergeAttributes, nodePasteRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CardReferenceChip from '../components/CardReferenceChip';

// Matches full card URLs pasted as plain text.
// e.g. http://localhost:5173/c/Ab12Cd34
const CARD_URL_PASTE_RE = /https?:\/\/[^\s/]*\/c\/[a-zA-Z0-9]+(?:[/?#][^\s]*)?/g;

/** Returns true when `url` points to a card detail URL (/c/{cardId}). */
export function isCardUrl(url: string): boolean {
  try {
    const u = new URL(url, 'http://x');
    return /^\/c\/[A-Za-z0-9]+$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** Extracts the cardId query param from a card URL, or returns null. */
export function parseCardIdFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, 'http://x').pathname;
    const match = pathname.match(/^\/c\/([A-Za-z0-9]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export const CardReference = Node.create({
  name: 'cardReference',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      href: { default: null },
      // [why] Title and listName are cached in attrs so renderMarkdown can produce
      // a meaningful link label without an async fetch at serialisation time.
      title: { default: null },
      listName: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        // [why] Priority 200 beats @tiptap/extension-link's default (0) so card
        // URLs are captured as chip nodes before the Link extension can claim them.
        priority: 200,
        tag: 'a[href]',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const href = el.getAttribute('href') ?? '';
          if (!isCardUrl(href)) return false;
          return {
            href,
            title: el.dataset['cardTitle'] ?? el.textContent ?? null,
            listName: el.dataset['cardList'] ?? null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Serialised to HTML with data attrs so parseHTML can restore chips on reload.
    return [
      'a',
      mergeAttributes(
        {
          'data-card-ref': 'true',
          'data-card-title': HTMLAttributes['title'] ?? '',
          'data-card-list': HTMLAttributes['listName'] ?? '',
        },
        { href: HTMLAttributes['href'] },
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardReferenceChip);
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: CARD_URL_PASTE_RE,
        type: this.type,
        getAttributes: (match) => ({ href: match[0] }),
      }),
    ];
  },

  // [why] @tiptap/markdown calls renderMarkdown for custom nodes during
  //       editor.getMarkdown(). Output a standard markdown link so the
  //       description round-trips as readable text.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderMarkdown(node: any): string {
    const href: string = node?.attrs?.href ?? '';
    const title: string = node?.attrs?.title ?? 'Card';
    return `[${title}](${href})`;
  },
});

export default CardReference;
