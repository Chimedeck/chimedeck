// List API wrappers used by boardSlice and board components.
// Re-exports from src/extensions/List/api.ts.
export {
  listLists,
  createList,
  updateList,
  archiveList,
  deleteList,
  reorderLists,
} from '../../List/api';
export type { List } from '../../List/api';
