// Global reducer registry — all extension reducers are combined here and
// passed to configureStore in src/store/index.ts.
export { authDuckReducer as authReducer } from './extensions/Auth/duck/authDuck';
export { workspaceShellReducer } from './extensions/Workspace/duck/workspaceDuck';
export { default as boardReducer } from './extensions/Board/slices/boardSlice';
export { default as boardListPageReducer } from './extensions/Board/containers/BoardListPage/BoardListPage.duck';
export { default as boardPageReducer } from './extensions/Board/containers/BoardPage/BoardPage.duck';
export { default as workspacePageReducer } from './extensions/Workspace/containers/WorkspacePage/WorkspacePage.duck';
export { default as cardDetailReducer } from './extensions/Card/slices/cardDetailSlice';
// Entity slices synced via WebSocket (sprint-20)
export { default as listReducer } from './extensions/List/listSlice';
export { default as cardsReducer } from './extensions/Card/cardSlice';
export { profileDuckReducer } from './extensions/User/containers/ProfilePage/ProfilePage.duck';
export { default as notificationReducer } from './extensions/Notification/slices/notificationSlice';
export { pluginDashboardReducer } from './extensions/Plugins/reducers';
export { adminInviteReducer } from './extensions/AdminInvite/adminInvite.slice';
