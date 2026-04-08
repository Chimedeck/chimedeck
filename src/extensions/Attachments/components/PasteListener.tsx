// PasteListener — invisible component that listens for clipboard paste events
// while the card modal is open. Handles:
//  - Image blobs → forwarded to onFiles for upload
//  - URL text (when no text input focused) → forwarded to onLink for attachment
import { useCallback } from 'react';
import { useClipboardPaste } from '../hooks/useClipboardPaste';

interface Props {
  /** Whether the parent card modal is currently mounted/open */
  enabled: boolean;
  onFiles: (files: File[]) => void;
  /** Called when a URL string is pasted outside of any text field. */
  onLink?: (url: string) => void;
}

// Renders nothing — purely side-effect component.
export function PasteListener({ enabled, onFiles, onLink }: Props): null {
  const stableOnFiles = useCallback(onFiles, []); // eslint-disable-line react-hooks/exhaustive-deps
  useClipboardPaste({ enabled, onFiles: stableOnFiles, onLink });
  return null;
}
