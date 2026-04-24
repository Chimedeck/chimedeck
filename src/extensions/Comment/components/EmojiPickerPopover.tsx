// EmojiPickerPopover — anchored popover wrapping @emoji-mart/react Picker.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPickerPopover = ({ anchorRef, onSelect, onClose }: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: 8,
    left: 8,
    zIndex: 90,
  });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    const margin = 8;
    const gap = 4;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const popoverWidth = popoverRect.width || 352;
    const popoverHeight = popoverRect.height || 420;

    const spaceBelow = viewportHeight - anchorRect.bottom;
    const shouldFlipUp = spaceBelow < popoverHeight + gap + margin;

    const unclampedTop = shouldFlipUp
      ? anchorRect.top - popoverHeight - gap
      : anchorRect.bottom + gap;

    const unclampedLeft = anchorRect.left;

    const clampedTop = Math.min(
      Math.max(margin, unclampedTop),
      Math.max(margin, viewportHeight - popoverHeight - margin),
    );

    const clampedLeft = Math.min(
      Math.max(margin, unclampedLeft),
      Math.max(margin, viewportWidth - popoverWidth - margin),
    );

    setStyle({
      position: 'fixed',
      top: clampedTop,
      left: clampedLeft,
      zIndex: 90,
    });
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [anchorRef, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Position on mount and whenever viewport/scroll context changes.
  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    const onReposition = () => updatePosition();
    window.addEventListener('resize', onReposition);
    // capture=true catches scroll from nested containers (e.g. modal body)
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [updatePosition]);

  return (
    <div ref={popoverRef} style={style}>
      <Picker
        data={data}
        onEmojiSelect={(e: { native: string }) => {
          onSelect(e.native);
          onClose();
        }}
        theme="dark"
        previewPosition="none"
        skinTonePosition="none"
      />
    </div>
  );
};

export default EmojiPickerPopover;
