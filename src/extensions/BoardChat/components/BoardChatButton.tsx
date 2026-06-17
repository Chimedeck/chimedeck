import IconButton from '~/common/components/IconButton';

// BoardChatButton — header icon to open the board chat drawer.
// Only visible to non-guest members when BOARD_CHAT_ENABLED is true.

interface Props {
  onClick?: () => void;
  hasBackground?: boolean;
}

const BoardChatButton = ({ onClick, hasBackground = false }: Props) => {
  return (
    <IconButton
      aria-label="Board chat"
      title="Open board chat"
      icon={(
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      )}
      onClick={onClick}
      className={hasBackground ? 'text-white/90 hover:bg-white/20 hover:text-white' : 'text-muted hover:bg-bg-surface hover:text-subtle'}
    />
  );
};

export default BoardChatButton;
