// AttachmentDropZone — full-panel overlay with a dashed border and ArrowUpTrayIcon
// that appears while a file is dragged over the card modal, then triggers upload on drop.
import React, { useCallback, useRef, useState } from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import translations from '../translations/en.json';

interface Props {
  /** Children to render beneath the drop overlay */
  children: React.ReactNode;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  /** Listen for drag/drop on this node only, or globally (document-level), or both. */
  scope?: 'local' | 'global' | 'both';
  /** CSS selector that the drop target must be inside for global handling to apply. */
  activeWithinSelector?: string;
  /** CSS selectors where global handling should be ignored (e.g. rich-text editors). */
  excludeSelectors?: string[];
}

export function AttachmentDropZone({
  children,
  onFiles,
  disabled = false,
  scope = 'local',
  activeWithinSelector,
  excludeSelectors = [],
}: Readonly<Props>): React.ReactElement {
  const [isDragOver, setIsDragOver] = useState(false);
  // Track the drag depth so we don't flicker when hovering child elements
  const dragDepth = useRef(0);
  const globalDragDepth = useRef(0);
  const handlesLocal = scope === 'local' || scope === 'both';
  const handlesGlobal = scope === 'global' || scope === 'both';

  const hasFilePayload = useCallback((transfer: DataTransfer | null | undefined): boolean => {
    if (!transfer) return false;
    if (transfer.files && transfer.files.length > 0) return true;
    return Array.from(transfer.types ?? []).includes('Files');
  }, []);

  const isExcludedTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;

    if (activeWithinSelector && !target.closest(activeWithinSelector)) {
      return true;
    }

    return excludeSelectors.some((selector) => target.closest(selector));
  }, [activeWithinSelector, excludeSelectors]);

  const handleDragEnter = useCallback((ev: React.DragEvent) => {
    if (!handlesLocal) return;
    if (!hasFilePayload(ev.dataTransfer)) return;
    ev.preventDefault();
    ev.stopPropagation();
    dragDepth.current++;
    if (!disabled) setIsDragOver(true);
  }, [disabled, handlesLocal, hasFilePayload]);

  const handleDragLeave = useCallback((ev: React.DragEvent) => {
    if (!handlesLocal) return;
    ev.preventDefault();
    ev.stopPropagation();
    dragDepth.current--;
    if (dragDepth.current === 0) setIsDragOver(false);
  }, [handlesLocal]);

  const handleDragOver = useCallback((ev: React.DragEvent) => {
    if (!handlesLocal) return;
    if (!hasFilePayload(ev.dataTransfer)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
  }, [handlesLocal, hasFilePayload]);

  const handleDrop = useCallback(
    (ev: React.DragEvent) => {
      if (!handlesLocal) return;
      if (!hasFilePayload(ev.dataTransfer)) return;
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
    [disabled, handlesLocal, hasFilePayload, onFiles],
  );

  React.useEffect(() => {
    if (!handlesGlobal || disabled) return;

    const onGlobalDragEnter = (ev: DragEvent): void => {
      if (!hasFilePayload(ev.dataTransfer) || isExcludedTarget(ev.target)) return;
      ev.preventDefault();
      globalDragDepth.current += 1;
      setIsDragOver(true);
    };

    const onGlobalDragOver = (ev: DragEvent): void => {
      if (!hasFilePayload(ev.dataTransfer) || isExcludedTarget(ev.target)) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
      if (!isDragOver) setIsDragOver(true);
    };

    const onGlobalDragLeave = (ev: DragEvent): void => {
      if (!hasFilePayload(ev.dataTransfer) || isExcludedTarget(ev.target)) return;
      globalDragDepth.current = Math.max(globalDragDepth.current - 1, 0);
      if (globalDragDepth.current === 0) setIsDragOver(false);
    };

    const onGlobalDrop = (ev: DragEvent): void => {
      if (!hasFilePayload(ev.dataTransfer) || isExcludedTarget(ev.target)) return;
      ev.preventDefault();
      globalDragDepth.current = 0;
      setIsDragOver(false);
      if (disabled) return;

      const files = Array.from(ev.dataTransfer?.files ?? []);
      if (files.length > 0) onFiles(files);
    };

    const resetDragState = (): void => {
      globalDragDepth.current = 0;
      setIsDragOver(false);
    };

    document.addEventListener('dragenter', onGlobalDragEnter, true);
    document.addEventListener('dragover', onGlobalDragOver, true);
    document.addEventListener('dragleave', onGlobalDragLeave, true);
    document.addEventListener('drop', onGlobalDrop, true);
    globalThis.addEventListener('dragend', resetDragState, true);

    return () => {
      document.removeEventListener('dragenter', onGlobalDragEnter, true);
      document.removeEventListener('dragover', onGlobalDragOver, true);
      document.removeEventListener('dragleave', onGlobalDragLeave, true);
      document.removeEventListener('drop', onGlobalDrop, true);
      globalThis.removeEventListener('dragend', resetDragState, true);
    };
  }, [disabled, handlesGlobal, hasFilePayload, isDragOver, isExcludedTarget, onFiles]);

  return (
    <div
      className="relative"
      data-attachment-dropzone-root="true"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Full-panel overlay — only visible while dragging */}
      {isDragOver && (
        <div
          className={[
            handlesGlobal ? 'fixed inset-0 z-[60]' : 'absolute inset-0 z-10',
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/90 pointer-events-none',
          ].join(' ')}
          aria-hidden="true"
        >
          <ArrowUpTrayIcon className="h-10 w-10 text-blue-400 mb-2" />
          <span className="text-sm font-medium text-blue-600">{translations['attachments.dropZone.hint']}</span>
        </div>
      )}
    </div>
  );
}
