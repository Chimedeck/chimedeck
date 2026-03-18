// Minimal inline-image Tiptap extension for use in the comment editor.
// Intentionally self-contained — does not depend on @tiptap/extension-image
// whose built dist is not included in the package at this version.
import { Node, mergeAttributes } from '@tiptap/core';

export interface InlineImageOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineImage: {
      /** Insert an inline image at the current position */
      setInlineImage: (attrs: { src: string; alt?: string }) => ReturnType;
    };
  }
}

export const InlineImage = Node.create<InlineImageOptions>({
  name: 'image',

  // Hook this node into @tiptap/markdown so image tokens round-trip.
  markdownTokenName: 'image',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  inline: true,
  group: 'inline',
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addCommands() {
    return {
      setInlineImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  parseMarkdown(token: any, helpers: any) {
    const src = typeof token?.href === 'string' ? token.href : '';
    const alt = typeof token?.text === 'string' ? token.text : null;
    const title = typeof token?.title === 'string' ? token.title : null;
    if (!src) return null;
    return helpers.createNode(this.name, { src, alt, title });
  },

  renderMarkdown(node: any) {
    const src = typeof node?.attrs?.src === 'string' ? node.attrs.src : '';
    const alt = typeof node?.attrs?.alt === 'string' ? node.attrs.alt : '';
    const title = typeof node?.attrs?.title === 'string' ? node.attrs.title : '';
    if (!src) return '';
    // Keep title optional to match standard markdown image syntax.
    return title
      ? `![${alt}](${src} "${title}")`
      : `![${alt}](${src})`;
  },
});

export default InlineImage;
