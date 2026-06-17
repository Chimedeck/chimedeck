// AIAssistButton — "AI Assist" button placed in the card modal sidebar.
// Sprint 171: Gated by innerCardChatEnabled feature flag.
// On click: starts a card-chat session and opens the CardChatDrawer.
import { SparklesIcon } from '@heroicons/react/24/outline';
import Button from '~/common/components/Button';

interface Props {
  cardId: string;
  enabled: boolean;
  disabled?: boolean;
  onStartChat: (cardId: string) => void;
}

const AIAssistButton = ({ cardId, enabled, disabled, onStartChat }: Props) => {
  if (!enabled) return null;

  return (
    <Button
      variant="ghost"
      size="md"
      className="w-full justify-start gap-2"
      disabled={disabled}
      onClick={() => onStartChat(cardId)}
    >
      <SparklesIcon className="w-4 h-4 shrink-0 text-blue-500" />
      AI Assist
    </Button>
  );
};

export default AIAssistButton;
