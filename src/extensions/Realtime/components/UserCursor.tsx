// UserCursor — optional component that highlights a card currently being
// edited by another user.  Shown as a subtle coloured border + name badge.
//
// WHY: per spec §6, presence UI should show other editors without blocking.
// This component is intentionally minimal; advanced cursor-tracking is deferred.
import type { PresenceUser } from './PresenceAvatars';

interface UserCursorProps {
  /** The user who is currently editing this card (undefined = no one else) */
  editor: PresenceUser | undefined;
  children: React.ReactNode;
}

const UserCursor: React.FC<UserCursorProps> = ({ editor, children }) => {
  if (!editor) return <>{children}</>;

  return (
    <div
      className="relative rounded"
      style={{ outline: `2px solid ${editor.color}`, outlineOffset: '2px' }}
    >
      {children}
      {/* Name badge — floats above the top-right corner */}
      <span
        className="absolute -top-5 right-0 rounded px-1 py-0.5 text-xs font-semibold text-white"
        style={{ backgroundColor: editor.color }}
      >
        {editor.displayName}
      </span>
    </div>
  );
};

export default UserCursor;
