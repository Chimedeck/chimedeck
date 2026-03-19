// useClipboardPaste — listens for clipboard paste events while the card modal
// is open, extracts image blobs from DataTransfer, and returns them as Files
// named pasted-image-<timestamp>.png.
import { useEffect } from 'react';

interface UseClipboardPasteOptions {
  /** Whether the consuming component is currently mounted/visible */
  enabled: boolean;
  onFiles: (files: File[]) => void;
}

export function useClipboardPaste({ enabled, onFiles }: UseClipboardPasteOptions): void {
  useEffect(() => {
    if (!enabled) return;

    function handlePaste(ev: ClipboardEvent): void {
      const items = ev.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];

      for (const item of Array.from(items)) {
        if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
        const blob = item.getAsFile();
        if (!blob) continue;

        const timestamp = Date.now();
        const file = new File([blob], `pasted-image-${timestamp}.png`, {
          type: 'image/png',
        });
        imageFiles.push(file);
      }

      if (imageFiles.length > 0) {
        // Prevent the paste from landing in any focused text input
        ev.preventDefault();
        onFiles(imageFiles);
      }
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [enabled, onFiles]);
}
