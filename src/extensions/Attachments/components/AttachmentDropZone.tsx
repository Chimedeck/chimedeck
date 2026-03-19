// AttachmentDropZone — full-panel overlay with a dashed border and ArrowUpTrayIcon
// that appears while a file is dragged over the card modal, then triggers upload on drop.
import React, { useCallback, useRef, useState } from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface Props {
  /** Children to render beneath the drop overlay */
  children: React.ReactNode;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function AttachmentDropZone({ children, onFiles, disabled = false }: Props): React.ReactElement {
  const [isDragOver, setIsDragOver] = useState(false);
  // Track the drag depth so we don't flicker when hovering child elements
  const dragDepth = useRef(0);

  const handleDragEnter = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    dragDepth.current++;
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    dragDepth.current--;
    if (dragDepth.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (ev: React.DragEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      dragDepth.current = 0;
      setIsDragOver(false);
      if (disabled) return;

      const files = Array.from(ev.dataTransfer.files);
      if (files.length > 0) {
        onFiles(files);
      }
    },
    [disabled, onFiles],
  );

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Full-panel overlay — only visible while dragging */}
      {isDragOver && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center
                     rounded-lg border-2 border-dashed border-blue-400
                     bg-blue-50/90 pointer-events-none"
          aria-hidden="true"
        >
          <ArrowUpTrayIcon className="h-10 w-10 text-blue-400 mb-2" />
          <span className="text-sm font-medium text-blue-600">Drop files to attach</span>
        </div>
      )}
    </div>
  );
}
