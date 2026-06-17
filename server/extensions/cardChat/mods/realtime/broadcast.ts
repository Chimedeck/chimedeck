// CardChat realtime progress broadcasting.
// Sends card_chat.assist_progress events to the board's WebSocket room
// so the CardChatDrawer can show per-iteration phase labels and tool names.
import { broadcast } from '../../../realtime/mods/rooms/broadcast';

export interface CardChatProgress {
  sessionId: string;
  cardId: string;
  phase: 'thinking' | 'executing_tools' | 'done';
  toolNames?: string[];
  message?: string;
  actionCards?: CardChatAssistActionCard[];
}

export interface CardChatAssistActionCard {
  state: 'suggested' | 'confirmed' | 'dismissed';
  toolName: string;
  toolCallId: string;
  idempotencyKey: string;
  source: 'card-chat-assist';
  cardId: string;
  workspaceId: string;
  descriptionContent?: string;
  descriptionPreview?: string;
}

/**
 * Broadcast a card-chat progress event to the board's WebSocket room.
 * [why] Cards don't have their own WebSocket rooms — they belong to boards.
 * We broadcast to the board room so all viewers of the board (including
 * the card modal) receive the progress events.
 */
export function broadcastCardChatProgress(
  boardId: string,
  progress: CardChatProgress,
): void {
  broadcast({
    boardId,
    message: JSON.stringify({
      type: 'card_chat.assist_progress',
      board_id: boardId,
      payload: progress,
    }),
  });
}
