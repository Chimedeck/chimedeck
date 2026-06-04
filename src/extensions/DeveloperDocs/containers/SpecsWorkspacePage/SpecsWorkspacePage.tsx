// SpecsWorkspacePage — split-pane workspace for viewing and editing specs markdown files.
// Left pane: SpecsFileTree listing all specs/*.md paths from the manifest.
// Right pane: SpecsMarkdownEditor for the selected file.
// Dirty tracking: a Set<path> records files with uncommitted local edits.
// Sprint 170: Documentation board tab, workspace shell, manifest load, file read, delta save, commit sync.
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { apiClient } from '~/common/api/client';
import SpecsFileTree from '../../components/SpecsFileTree';
import SpecsMarkdownEditor from '../../components/SpecsMarkdownEditor';
import type { SpecsManifestEntry } from '../../components/SpecsFileTree';

interface SpecsManifest {
  ref: string;
  fetchedAt: string;
  files: SpecsManifestEntry[];
  etag: string;
}

interface SpecsFileResponse {
  path: string;
  content: string;
  etag: string;
}

interface SpecsSaveResponse {
  path: string;
  content: string;
  etag: string;
  sha: string;
  created: boolean;
}

interface SpecsCommitResponse {
  commitHash: string;
  pushStatus: 'pushed' | 'pending';
  branch: string;
  changedFiles: string[];
  footer: {
    actorId: string;
    boardId: string;
    botAlias: string;
  };
}

type ApiHandle = { get: <T>(url: string) => Promise<T> };

type RequestError = Error & { status?: number };

async function fetchSpecsManifest({ api, boardId }: { api: ApiHandle; boardId: string }): Promise<SpecsManifest> {
  const res = await api.get<{ data: SpecsManifest }>(`/boards/${boardId}/specs/manifest`);
  return res.data;
}

async function fetchSpecsFile({
  api,
  boardId,
  path,
}: {
  api: ApiHandle;
  boardId: string;
  path: string;
}): Promise<SpecsFileResponse> {
  const res = await api.get<{ data: SpecsFileResponse }>(
    `/boards/${boardId}/specs/files?path=${encodeURIComponent(path)}`,
  );
  return res.data;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const candidate = (payload as {
    data?: { message?: unknown };
    error?: { message?: unknown };
    message?: unknown;
  });

  if (typeof candidate.data?.message === 'string') return candidate.data.message;
  if (typeof candidate.error?.message === 'string') return candidate.error.message;
  if (typeof candidate.message === 'string') return candidate.message;
  return fallback;
}

async function requestSpecsJson<T>({
  boardId,
  path,
  method,
  body,
  accessToken,
  ifMatch,
}: {
  boardId: string;
  path: string;
  method: 'PUT' | 'POST';
  body: unknown;
  accessToken: string | null;
  ifMatch?: string | null;
}): Promise<T> {
  const response = await fetch(`/api/v1/boards/${boardId}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(ifMatch ? { 'If-Match': ifMatch } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      extractErrorMessage(payload, `Request failed with status code ${response.status}`),
    ) as RequestError;
    error.status = response.status;
    throw error;
  }

  return (payload as { data: T }).data;
}

interface WorkspaceState {
  manifestStatus: 'idle' | 'loading' | 'loaded' | 'error';
  manifestError: string | null;
  files: SpecsManifestEntry[];
  selectedPath: string | null;
  fileStatus: 'idle' | 'loading' | 'loaded' | 'error';
  fileError: string | null;
  savedContent: Record<string, string>;
  savedEtags: Record<string, string>;
  editorContent: Record<string, string>;
  dirtyPaths: Set<string>;
  pendingCommitPaths: Set<string>;
  lastSaveAttemptContent: Record<string, string>;
  isSaving: boolean;
  saveError: string | null;
  saveErrorPath: string | null;
  saveErrorStatus: number | null;
  commitStatus: 'idle' | 'committing' | 'success' | 'error';
  commitError: string | null;
  commitMessage: string;
}

type WorkspaceAction =
  | { type: 'manifest/loading' }
  | { type: 'manifest/loaded'; files: SpecsManifestEntry[] }
  | { type: 'manifest/error'; message: string }
  | { type: 'file/select'; path: string }
  | { type: 'file/ready' }
  | { type: 'file/loading' }
  | { type: 'file/loaded'; path: string; content: string; etag: string; forceEditorContent?: boolean }
  | { type: 'file/error'; message: string }
  | { type: 'editor/change'; path: string; content: string }
  | { type: 'save/start'; path: string; content: string }
  | { type: 'save/success'; path: string; content: string; etag: string; sha: string; created: boolean }
  | { type: 'save/error'; path: string; content: string; message: string; status: number | null }
  | { type: 'save/conflict-clear' }
  | { type: 'commit/message'; message: string }
  | { type: 'commit/start' }
  | { type: 'commit/success'; changedFiles: string[] }
  | { type: 'commit/error'; message: string };

function setPathValue(state: WorkspaceState, path: string, content: string, etag: string) {
  const nextDirty = new Set(state.dirtyPaths);
  if (state.savedContent[path] === content) {
    nextDirty.delete(path);
  }

  return {
    ...state,
    savedContent: { ...state.savedContent, [path]: content },
    savedEtags: { ...state.savedEtags, [path]: etag },
    dirtyPaths: nextDirty,
  };
}

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'manifest/loading':
      return { ...state, manifestStatus: 'loading', manifestError: null, files: state.files ?? [] };
    case 'manifest/loaded':
      return { ...state, manifestStatus: 'loaded', files: action.files };
    case 'manifest/error':
      return { ...state, manifestStatus: 'error', manifestError: action.message };

    case 'file/select':
      return { ...state, selectedPath: action.path, fileError: null };
    case 'file/ready':
      return { ...state, fileStatus: 'loaded', fileError: null };
    case 'file/loading':
      return { ...state, fileStatus: 'loading', fileError: null };
    case 'file/loaded': {
      const nextState = setPathValue(state, action.path, action.content, action.etag);
      const nextDirtyPaths = new Set(nextState.dirtyPaths);
      const nextPendingCommitPaths = new Set(nextState.pendingCommitPaths);
      if (action.forceEditorContent) {
        nextDirtyPaths.delete(action.path);
        nextPendingCommitPaths.delete(action.path);
      }

      return {
        ...nextState,
        fileStatus: 'loaded',
        fileError: null,
        editorContent: action.forceEditorContent
          ? { ...nextState.editorContent, [action.path]: action.content }
          : (action.path in nextState.editorContent
            ? nextState.editorContent
            : { ...nextState.editorContent, [action.path]: action.content }),
        lastSaveAttemptContent: action.forceEditorContent
          ? { ...nextState.lastSaveAttemptContent, [action.path]: action.content }
          : nextState.lastSaveAttemptContent,
        dirtyPaths: nextDirtyPaths,
        pendingCommitPaths: nextPendingCommitPaths,
        saveError: null,
        saveErrorPath: null,
        saveErrorStatus: null,
      };
    }
    case 'file/error':
      return { ...state, fileStatus: 'error', fileError: action.message };

    case 'editor/change': {
      const nextDirty = new Set(state.dirtyPaths);
      const nextPendingCommitPaths = new Set(state.pendingCommitPaths);
      const saved = state.savedContent[action.path];
      if (saved !== undefined && action.content !== saved) {
        nextDirty.add(action.path);
        nextPendingCommitPaths.delete(action.path);
      } else if (saved !== undefined) {
        nextDirty.delete(action.path);
        if (state.lastSaveAttemptContent[action.path] === saved) {
          nextPendingCommitPaths.add(action.path);
        }
      }

      return {
        ...state,
        editorContent: { ...state.editorContent, [action.path]: action.content },
        dirtyPaths: nextDirty,
        pendingCommitPaths: nextPendingCommitPaths,
        commitStatus: 'idle',
        saveError: null,
        saveErrorPath: null,
        saveErrorStatus: null,
      };
    }

    case 'save/start':
      return {
        ...state,
        isSaving: true,
        saveError: null,
        saveErrorPath: null,
        saveErrorStatus: null,
        lastSaveAttemptContent: { ...state.lastSaveAttemptContent, [action.path]: action.content },
      };
    case 'save/success': {
      const nextState = setPathValue(state, action.path, action.content, action.etag);
      const currentContent = nextState.editorContent[action.path];
      const nextDirtyPaths = new Set(nextState.dirtyPaths);
      const nextPendingCommitPaths = new Set(nextState.pendingCommitPaths);
      if (currentContent === action.content) {
        // Editor content matches what was just saved — the file is clean and ready to commit.
        nextDirtyPaths.delete(action.path);
        nextPendingCommitPaths.add(action.path);
      }

      return {
        ...nextState,
        isSaving: false,
        saveError: null,
        saveErrorPath: null,
        saveErrorStatus: null,
        commitStatus: 'idle',
        dirtyPaths: nextDirtyPaths,
        pendingCommitPaths: nextPendingCommitPaths,
        lastSaveAttemptContent: { ...nextState.lastSaveAttemptContent, [action.path]: action.content },
      };
    }
    case 'save/error':
      return {
        ...state,
        isSaving: false,
        saveError: action.message,
        saveErrorPath: action.path,
        saveErrorStatus: action.status,
        lastSaveAttemptContent: { ...state.lastSaveAttemptContent, [action.path]: action.content },
      };

    case 'save/conflict-clear':
      return {
        ...state,
        saveError: null,
        saveErrorPath: null,
        saveErrorStatus: null,
      };

    case 'commit/message':
      return { ...state, commitMessage: action.message, commitStatus: 'idle', commitError: null };
    case 'commit/start':
      return { ...state, commitStatus: 'committing', commitError: null };
    case 'commit/success':
      {
        const nextPendingCommitPaths = new Set(state.pendingCommitPaths);
        for (const changedFile of action.changedFiles) {
          nextPendingCommitPaths.delete(changedFile);
        }

        return {
          ...state,
          commitStatus: 'success',
          commitError: null,
          pendingCommitPaths: nextPendingCommitPaths,
          commitMessage: '',
          lastSaveAttemptContent: action.changedFiles.reduce<Record<string, string>>((acc, path) => {
            acc[path] = state.savedContent[path] ?? '';
            return acc;
          }, { ...state.lastSaveAttemptContent }),
        };
      }
    case 'commit/error':
      return { ...state, commitStatus: 'error', commitError: action.message };

    default:
      return state;
  }
}

const initialState: WorkspaceState = {
  manifestStatus: 'idle',
  manifestError: null,
  files: [],
  selectedPath: null,
  fileStatus: 'idle',
  fileError: null,
  savedContent: {},
  savedEtags: {},
  editorContent: {},
  dirtyPaths: new Set(),
  pendingCommitPaths: new Set(),
  lastSaveAttemptContent: {},
  isSaving: false,
  saveError: null,
  saveErrorPath: null,
  saveErrorStatus: null,
  commitStatus: 'idle',
  commitError: null,
  commitMessage: '',
};

export interface SpecsWorkspacePageProps {
  boardId: string;
  accessToken?: string | null;
  canEdit?: boolean;
}

const SpecsWorkspacePage = ({
  boardId,
  accessToken = null,
  canEdit = false,
}: SpecsWorkspacePageProps) => {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);
  const api: ApiHandle = apiClient;

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'manifest/loading' });

    fetchSpecsManifest({ api, boardId })
      .then((manifest) => {
        if (cancelled) return;
        dispatch({ type: 'manifest/loaded', files: manifest.files });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load specs manifest';
        dispatch({ type: 'manifest/error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  useEffect(() => {
    const { selectedPath } = state;
    if (!selectedPath) return;
    if (selectedPath in state.savedContent) {
      if (state.fileStatus !== 'loaded' || state.fileError) {
        dispatch({ type: 'file/ready' });
      }
      return;
    }
    const shouldForceEditorContent = !canEdit || !(selectedPath in state.editorContent);

    let cancelled = false;
    dispatch({ type: 'file/loading' });

    fetchSpecsFile({ api, boardId, path: selectedPath })
      .then((file) => {
        if (cancelled) return;
        dispatch({
          type: 'file/loaded',
          path: selectedPath,
          content: file.content,
          etag: file.etag,
          forceEditorContent: shouldForceEditorContent,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load file';
        dispatch({ type: 'file/error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [boardId, canEdit, state.editorContent, state.savedContent, state.selectedPath]);

  const handleSelectFile = useCallback((path: string) => {
    dispatch({ type: 'file/select', path });
  }, []);

  const handleEditorChange = useCallback(
    (content: string) => {
      if (!state.selectedPath || !canEdit) return;
      dispatch({ type: 'editor/change', path: state.selectedPath, content });
    },
    [canEdit, state.selectedPath],
  );

  const handleRetry = useCallback(() => {
    dispatch({ type: 'manifest/loading' });
    fetchSpecsManifest({ api, boardId })
      .then((manifest) => dispatch({ type: 'manifest/loaded', files: manifest.files }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load specs manifest';
        dispatch({ type: 'manifest/error', message });
      });
  }, [api, boardId]);

  const handleReloadSelectedFile = useCallback(async () => {
    if (!state.selectedPath) return;
    const selectedPath = state.selectedPath;
    try {
      const file = await fetchSpecsFile({ api, boardId, path: selectedPath });
      dispatch({
        type: 'file/loaded',
        path: selectedPath,
        content: file.content,
        etag: file.etag,
        forceEditorContent: true,
      });
      dispatch({ type: 'save/conflict-clear' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reload file';
      dispatch({ type: 'file/error', message });
    }
  }, [api, boardId, state.selectedPath]);

  const currentPath = state.selectedPath;
  const currentContent = currentPath ? (state.editorContent[currentPath] ?? '') : '';
  const currentSavedContent = currentPath ? state.savedContent[currentPath] ?? null : null;
  const currentAttemptContent = currentPath ? state.lastSaveAttemptContent[currentPath] ?? null : null;
  const currentSaveEtag = currentPath ? state.savedEtags[currentPath] ?? null : null;

  const saveFile = useCallback(
    async ({ path, content, etag }: { path: string; content: string; etag: string | null }) => {
      dispatch({ type: 'save/start', path, content });
      try {
        const result = await requestSpecsJson<SpecsSaveResponse>({
          boardId,
          path: '/github/specs/file',
          method: 'PUT',
          body: { path, content },
          accessToken,
          ifMatch: etag,
        });

        dispatch({
          type: 'save/success',
          path,
          content: result.content,
          etag: result.etag,
          sha: result.sha,
          created: result.created,
        });
      } catch (err) {
        const error = err as RequestError;
        dispatch({
          type: 'save/error',
          path,
          content,
          message: error.message,
          status: error.status ?? null,
        });
      }
    },
    [accessToken, boardId],
  );

  useEffect(() => {
    if (!canEdit || !currentPath) return;
    if (state.isSaving) return;
    if (currentSavedContent === null) return;
    if (currentContent === currentSavedContent) return;
    if (currentAttemptContent === currentContent) return;

    const timer = globalThis.setTimeout(() => {
      void saveFile({ path: currentPath, content: currentContent, etag: currentSaveEtag });
    }, 600);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [
    canEdit,
    currentAttemptContent,
    currentContent,
    currentPath,
    currentSaveEtag,
    currentSavedContent,
    saveFile,
    state.isSaving,
  ]);

  const commitChangedFiles = useMemo(() => [...state.pendingCommitPaths].sort(), [state.pendingCommitPaths]);

  const handleCommit = useCallback(async () => {
    if (!canEdit || commitChangedFiles.length === 0 || state.isSaving) return;

    dispatch({ type: 'commit/start' });
    try {
      const result = await requestSpecsJson<SpecsCommitResponse>({
        boardId,
        path: '/github/specs/commit',
        method: 'POST',
        body: {
          message: state.commitMessage.trim() || 'Update specs',
          changedFiles: commitChangedFiles,
        },
        accessToken,
      });

      dispatch({ type: 'commit/success', changedFiles: result.changedFiles });
    } catch (err) {
      const error = err as RequestError;
      dispatch({ type: 'commit/error', message: error.message });
    }
  }, [accessToken, boardId, canEdit, commitChangedFiles, state.commitMessage, state.isSaving]);

  if (state.manifestStatus === 'loading' || state.manifestStatus === 'idle') {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <p className="text-sm text-muted">Loading documentation…</p>
      </div>
    );
  }

  if (state.manifestStatus === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
        <p className="text-sm text-danger">{state.manifestError ?? 'Failed to load documentation.'}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-md bg-bg-overlay px-3 py-1.5 text-sm text-subtle hover:bg-bg-sunken"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!state.files || state.files.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12">
        <p className="text-sm text-muted">No documentation files found in this repository.</p>
        <p className="text-xs text-muted">
          Add markdown files to a <code className="font-mono">specs/</code> folder in your linked GitHub repository.
        </p>
      </div>
    );
  }

  const fileError = state.fileError;
  const saveConflict = state.saveErrorStatus === 412 && state.saveErrorPath === currentPath;
  const saveFailure = state.saveError && state.saveErrorPath === currentPath;

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-border bg-bg-surface">
        <div className="px-3 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Specs</p>
          <SpecsFileTree
            files={state.files}
            selectedPath={state.selectedPath}
            dirtyPaths={state.dirtyPaths}
            onSelect={handleSelectFile}
          />
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        {!state.selectedPath ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            Select a file to view it.
          </div>
        ) : state.fileStatus === 'loading' ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            Loading…
          </div>
        ) : fileError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <p className="text-sm text-danger">{fileError}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border bg-bg-base px-4 py-2 shrink-0">
              <span className="truncate font-mono text-xs text-muted" title={state.selectedPath}>
                {state.selectedPath}
              </span>
              <div className="flex items-center gap-2">
                {saveConflict ? (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    Conflict
                  </span>
                ) : state.isSaving ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    Saving…
                  </span>
                ) : state.dirtyPaths.has(state.selectedPath) ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    Unsaved
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Saved
                  </span>
                )}
                {state.pendingCommitPaths.has(state.selectedPath) && !state.dirtyPaths.has(state.selectedPath) && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    Ready to commit
                  </span>
                )}
              </div>
            </div>

            {saveConflict && (
              <div className="shrink-0 border-b border-red-300 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-200">File conflict detected</p>
                    <p className="text-xs text-red-800 dark:text-red-300">{state.saveError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReloadSelectedFile}
                    className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-50 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
                  >
                    Reload file
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <SpecsMarkdownEditor
                key={state.selectedPath}
                content={currentContent}
                onChange={handleEditorChange}
                readOnly={!canEdit}
              />
            </div>

            {canEdit && (
              <div className="shrink-0 border-t border-border bg-bg-surface px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted" htmlFor="specs-commit-message">
                      Commit message
                    </label>
                    <input
                      id="specs-commit-message"
                      type="text"
                      value={state.commitMessage}
                      onChange={(e) => dispatch({ type: 'commit/message', message: e.target.value })}
                      placeholder="Update specs"
                      className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCommit}
                    disabled={commitChangedFiles.length === 0 || state.isSaving || state.commitStatus === 'committing'}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Commit changes
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>{state.pendingCommitPaths.size} file(s) ready</span>
                  {state.isSaving && <span>Saving current file…</span>}
                  {state.commitStatus === 'committing' && <span>Creating commit…</span>}
                  {state.commitStatus === 'success' && <span>Commit created</span>}
                  {saveFailure && !saveConflict && <span className="text-danger">{state.saveError}</span>}
                  {saveConflict && (
                    <>
                      <span className="text-danger">{state.saveError}</span>
                      <button
                        type="button"
                        onClick={handleReloadSelectedFile}
                        className="rounded-md border border-border px-2 py-1 text-xs text-base hover:bg-bg-overlay"
                      >
                        Reload file
                      </button>
                    </>
                  )}
                  {state.commitError && <span className="text-danger">{state.commitError}</span>}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SpecsWorkspacePage;
export { workspaceReducer, initialState };
