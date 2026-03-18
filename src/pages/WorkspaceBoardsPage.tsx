// src/pages/WorkspaceBoardsPage.tsx
// Thin re-export so consumers in the pages directory can import the workspace
// boards page by its canonical page name. The full implementation — including
// realtime workspace sync, optimistic delete, and board list state — lives in
// the Board extension container.
export { default } from '~/extensions/Board/containers/BoardListPage/BoardListPage';
