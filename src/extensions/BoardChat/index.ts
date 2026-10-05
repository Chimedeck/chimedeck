// BoardChat extension entry point
export { default as BoardChatButton } from './components/BoardChatButton';
export { default as BoardChatDrawer } from './components/BoardChatDrawer';
export { useBoardChatHistory } from './hooks/useBoardChatHistory';
export type { ChatMessage, UseBoardChatHistoryResult } from './hooks/useBoardChatHistory';
export { getBoardChatPermissions, patchBoardChatPermissions } from './api';
export type { BoardChatPermissions, PatchBoardChatPermissionsBody } from './api';
