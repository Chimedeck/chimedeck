// GET /api/v1/boards/:id/activity — paginated activity feed for a board; min role: VIEWER.
// Delegates to the shared board activity handler in the activity extension.
export { handleBoardActivity as handleGetBoardActivity } from '../../activity/api/boardActivity';
