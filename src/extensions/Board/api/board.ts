// Board API wrappers used by boardSlice and BoardPage.
// Re-exports and thin wrappers around src/extensions/Board/api.ts.
export {
  listBoards,
  getBoard,
  createBoard,
  updateBoard,
  archiveBoard,
  deleteBoard,
  duplicateBoard,
} from '../api';
export type { Board, BoardState } from '../api';
