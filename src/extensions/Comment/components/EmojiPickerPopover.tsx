// EmojiPickerPopover — anchored popover wrapping @emoji-mart/react Picker.
import { useEffect, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EmojiPickerPopover = ({ anchorRef, onSelect, onClose }: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);

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

  // Position below-left of anchor
  const anchor = anchorRef.current;
  const rect = anchor?.getBoundingClientRect();
  const style: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 50,
      }
    : { position: 'fixed', top: 0, left: 0, zIndex: 50 };

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
