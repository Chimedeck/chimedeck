// Minimal inline-image Tiptap extension for use in the comment editor.
// Intentionally self-contained — does not depend on @tiptap/extension-image
// whose built dist is not included in the package at this version.
import {
  Node,
  mergeAttributes,
  type JSONContent,
} from '@tiptap/core';

export interface InlineImageOptions {
  HTMLAttributes: Record<string, unknown>;
}

interface MarkdownHelpers {
  createNode: (
    name: string,
    attrs: { src: string; alt: string | null; title: string | null },
  ) => JSONContent;
}

function getProperty(value: unknown, property: string): unknown {
  if (
    value === null ||
    (typeof value !== 'object' && typeof value !== 'function')
  ) {
    return undefined;
  }

  return Reflect.get(value, property);
}

function getStringProperty(value: unknown, property: string): string | undefined {
  const propertyValue = getProperty(value, property);
  return typeof propertyValue === 'string' ? propertyValue : undefined;
}

function getNestedStringProperty(
  value: unknown,
  parent: string,
  property: string,
): string | undefined {
  return getStringProperty(getProperty(value, parent), property);
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

  parseMarkdown(token: unknown, helpers: MarkdownHelpers) {
    const src = getStringProperty(token, 'href') ?? '';
    const alt = getStringProperty(token, 'text') ?? null;
    const title = getStringProperty(token, 'title') ?? null;
    if (!src) return null as never;
    return helpers.createNode(this.name as string, { src, alt, title });
  },

  renderMarkdown(node: unknown) {
    const src = getNestedStringProperty(node, 'attrs', 'src') ?? '';
    const alt = getNestedStringProperty(node, 'attrs', 'alt') ?? '';
    const title = getNestedStringProperty(node, 'attrs', 'title') ?? '';
    if (!src) return '';
    // Keep title optional to match standard markdown image syntax.
    return title
      ? `![${alt}](${src} "${title}")`
      : `![${alt}](${src})`;
  },
});

export default InlineImage;
