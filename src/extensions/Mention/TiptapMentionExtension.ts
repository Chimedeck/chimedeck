// Tiptap Mention extension wired up for our codebase:
//   - Fetches suggestions from /boards/:boardId/members/suggestions?q=...
//   - Renders a floating MentionList via tippy.js + ReactDOM
//   - Serialises mention nodes as plain @nickname text so our server-side
//     extractMentions() parser picks them up and sends notifications.
import { ReactRenderer } from '@tiptap/react';
import Mention from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';
import tippy, { type Instance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import apiClient from '~/common/api/client';
import MentionList, {
  type MentionListHandle,
  type MentionSuggestion,
} from './MentionList';

const DEBOUNCE_MS = 150;

function buildSuggestion(boardId: string): Partial<SuggestionOptions<MentionSuggestion>> {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    char: '@',

    // Fetch matching board members. Empty query returns all members.
    items: ({ query }): Promise<MentionSuggestion[]> =>
      new Promise((resolve) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          try {
            const result = (await apiClient.get(
              `/boards/${boardId}/members/suggestions?q=${encodeURIComponent(query)}`,
            )) as { data: MentionSuggestion[] };
            resolve(result.data);
          } catch {
            resolve([]);
          }
        }, DEBOUNCE_MS);
      }),

    render: () => {
      let renderer: ReactRenderer<MentionListHandle>;
      let popup: Instance[];

      return {
        onStart(props) {
          renderer = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            // [why] Radix Dialog sets body.style.pointerEvents='none' while a modal is open,
            // which blocks all mouse events on tippy popups appended to body. Appending inside
            // the dialog element keeps pointer-events working correctly.
            appendTo: () =>
              (props.editor.view.dom.closest('[role="dialog"]') as HTMLElement) ?? document.body,
            content: renderer.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          });
        },

        onUpdate(props) {
          renderer.updateProps(props);
          if (!props.clientRect) return;
          popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup[0]?.hide();
            return true;
          }
          return renderer.ref?.onKeyDown(props) ?? false;
        },

        onExit() {
          popup?.[0]?.destroy();
          renderer?.destroy();
        },
      };
    },
  };
}

/**
 * Returns a configured Tiptap Mention extension for the given board.
 * Pass this in the `extensions` array of useEditor:
 *   buildMentionExtension(boardId)
 */
export function buildMentionExtension(boardId: string) {
  return Mention.extend({
    // [why] @tiptap/markdown calls renderMarkdown to serialise custom nodes.
    // We output @nickname so the server extractMentions() parser works unchanged.
    renderMarkdown(node): string {
      const attrs = (node as { attrs?: Record<string, unknown> }).attrs ?? {};
      const nickname = (attrs['label'] ?? attrs['id'] ?? '') as string;
      return `@${nickname}`;
    },
  }).configure({
    HTMLAttributes: {
      class: 'rounded bg-blue-100 dark:bg-blue-900/60 px-1 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300',
    },
    renderText({ node }) {
      return `@${node.attrs.label ?? node.attrs.id ?? ''}`;
    },
    suggestion: buildSuggestion(boardId),
  });
}
