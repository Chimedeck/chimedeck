// AIAssistButton — "AI Assist" button placed in the card modal sidebar.
// Sprint 171: Gated by innerCardChatEnabled feature flag.
// On click: starts a card-chat session and opens the CardChatDrawer.
import { SparklesIcon } from '@heroicons/react/24/outline';

interface Props {
  cardId: string;
  enabled: boolean;
  disabled?: boolean;
  onStartChat: (cardId: string) => void;
}

const AIAssistButton = ({ cardId, enabled, disabled, onStartChat }: Props) => {
  if (!enabled) return null;

  return (
    <button
      type="button"
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-base hover:bg-bg-overlay rounded-lg transition-colors disabled:opacity-40"
      disabled={disabled}
      onClick={() => onStartChat(cardId)}
    >
      <SparklesIcon className="w-4 h-4 shrink-0 text-blue-500" />
      AI Assist
    </button>
  );
};

export default AIAssistButton;
