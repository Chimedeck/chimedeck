// Global reducer registry — all extension reducers are combined here and
// passed to configureStore in src/store/index.ts.
export { authDuckReducer as authReducer } from './extensions/Auth/duck/authDuck';
export { workspaceShellReducer } from './extensions/Workspace/duck/workspaceDuck';
export { default as boardReducer } from './extensions/Board/slices/boardSlice';
export { default as cardDetailReducer } from './extensions/Card/slices/cardDetailSlice';
