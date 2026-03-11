// PasteListener — invisible component that listens for clipboard paste events
// while the card modal is open. Extracts image blobs and names them
// pasted-image-<timestamp>.png before forwarding to upload logic.
import { useCallback } from 'react';
import { useClipboardPaste } from '../hooks/useClipboardPaste';

interface Props {
  /** Whether the parent card modal is currently mounted/open */
  enabled: boolean;
  onFiles: (files: File[]) => void;
}

// Renders nothing — purely side-effect component.
export function PasteListener({ enabled, onFiles }: Props): null {
  const stableOnFiles = useCallback(onFiles, []); // eslint-disable-line react-hooks/exhaustive-deps
  useClipboardPaste({ enabled, onFiles: stableOnFiles });
  return null;
}
