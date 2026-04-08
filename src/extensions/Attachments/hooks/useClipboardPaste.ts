// useClipboardPaste — listens for clipboard paste events while the card modal
// is open. Handles two cases:
//  1. Image blobs → extracted as Files named pasted-image-<timestamp>.png
//  2. URL text → forwarded via onLink when no text input is focused
import { useEffect } from 'react';

interface UseClipboardPasteOptions {
  /** Whether the consuming component is currently mounted/visible */
  enabled: boolean;
  onFiles: (files: File[]) => void;
  /** Called when the clipboard contains a URL string and no text field is focused. */
  onLink?: (url: string) => void;
}

/** Returns true when a text-entry element currently has focus (input, textarea, contenteditable). */
function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useClipboardPaste({ enabled, onFiles, onLink }: UseClipboardPasteOptions): void {
  useEffect(() => {
    if (!enabled) return;

    function handlePaste(ev: ClipboardEvent): void {
      const items = ev.clipboardData?.items;
      if (!items) return;

      // --- Image files ---
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        const timestamp = Date.now();
        imageFiles.push(new File([blob], `pasted-image-${timestamp}.png`, { type: 'image/png' }));
      }

      if (imageFiles.length > 0) {
        ev.preventDefault();
        onFiles(imageFiles);
        return;
      }

      // --- URL text (only when not typing in a text field) ---
      if (onLink && !isTextInputFocused()) {
        const textPlain = ev.clipboardData?.getData('text/plain')?.trim() ?? '';
        if (/^https?:\/\//i.test(textPlain)) {
          ev.preventDefault();
          onLink(textPlain);
        }
      }
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [enabled, onFiles, onLink]);
}
