// MemberAvatarPopover — profile popover shown when clicking a member avatar.
// Sprint 28 spec: anchored to clicked element, context-aware action buttons.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

interface Member {
  id: string;
  name: string | null;
  email: string;
  nickname?: string | null;
  avatar_url?: string | null;
}

interface Props {
  member: Member;
  isSelf: boolean;
  onRemove?: () => Promise<void> | void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

function getInitials(name: string | null, email: string): string {
  const src = name ?? email;
  return src
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const MemberAvatarPopover = ({ member, isSelf, onRemove, onClose, anchorRef }: Props) => {
  const navigate = useNavigate();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [removing, setRemoving] = useState(false);

  // Position relative to anchor element, clamped to viewport
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popoverWidth = popoverRef.current?.offsetWidth ?? 224; // w-56 = 224px fallback
    const popoverHeight = popoverRef.current?.offsetHeight ?? 200;
    const margin = 8;

    let top = rect.bottom + margin;
    let left = rect.left;

    // Clamp right edge
    if (left + popoverWidth > window.innerWidth - margin) {
      left = window.innerWidth - popoverWidth - margin;
    }
    // Clamp left edge
    if (left < margin) left = margin;

    // Flip above if not enough space below
    if (top + popoverHeight > window.innerHeight - margin) {
      top = rect.top - popoverHeight - margin;
    }

    setPos({ top, left });
  }, [anchorRef]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const onMousedown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMousedown);
    return () => document.removeEventListener('mousedown', onMousedown);
  }, [onClose, anchorRef]);

  const handleRemove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setRemoving(false);
    }
  };

  const handleEditProfile = () => {
    onClose();
    navigate('/profile/edit');
  };

  const initials = getInitials(member.name, member.email);
  const handle = member.nickname ? `@${member.nickname}` : member.email;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 bg-bg-surface border border-border rounded-xl shadow-2xl p-4 w-56"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-modal="true"
      aria-label={`Profile: ${member.name ?? member.email}`}
    >
      {/* Close button */}
      <button
        className="absolute top-2 right-2 text-subtle hover:text-base rounded p-0.5"
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>

      {/* Avatar + name/handle */}
      {/* [theme-exception] text-white on indigo-500 avatar background */}
      <div className="flex items-center gap-3 mb-3">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={member.name ?? member.email}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold text-white"> // [theme-exception] text-white on indigo-500 avatar background
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-base truncate">
            {member.name ?? member.email}
          </p>
          <p className="text-xs text-subtle truncate">{handle}</p>
        </div>
      </div>

      {/* Actions */}
      {isSelf ? (
        <button
          className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-bg-overlay text-base"
          onClick={handleEditProfile}
        >
          Edit profile info
        </button>
      ) : (
        <button
          className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-900/40 text-danger flex items-center gap-2"
          onClick={handleRemove}
          disabled={removing}
        >
          {removing ? (
            <span className="inline-block h-3 w-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          ) : null}
          Remove from card
        </button>
      )}
    </div>,
    document.body
  );
};
