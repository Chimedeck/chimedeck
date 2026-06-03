// Test for SpecsWorkspacePage reducer logic - validates state transitions for conflict recovery
import { describe, it, expect } from 'vitest';

// Inline reducer from SpecsWorkspacePage for testing
interface WorkspaceState {
  manifestStatus: 'idle' | 'loading' | 'loaded' | 'error';
  manifestError: string | null;
  files: any[];
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
  | { type: 'save/error'; path: string; content: string; message: string; status: number | null }
  | { type: 'save/conflict-clear' }
  | { type: 'manifest/loading' };

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'manifest/loading':
      return { ...state, manifestStatus: 'loading', manifestError: null, files: state.files ?? [] };
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
    default:
      return state;
  }
}

describe('SpecsWorkspacePage Reducer - Conflict Recovery', () => {
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

  it('records a stale save conflict (412 status)', () => {
    const state = workspaceReducer(initialState, {
      type: 'save/error',
      path: 'specs/architecture.md',
      content: '# Updated',
      message: 'The file changed on the server. Reload and try again.',
      status: 412,
    });

    expect(state.saveError).toBe('The file changed on the server. Reload and try again.');
    expect(state.saveErrorPath).toBe('specs/architecture.md');
    expect(state.saveErrorStatus).toBe(412);
    expect(state.isSaving).toBe(false);
  });

  it('clears conflict state with save/conflict-clear action', () => {
    const stateWithConflict: WorkspaceState = {
      ...initialState,
      saveError: 'The file changed on the server. Reload and try again.',
      saveErrorPath: 'specs/architecture.md',
      saveErrorStatus: 412,
    };

    const state = workspaceReducer(stateWithConflict, {
      type: 'save/conflict-clear',
    });

    expect(state.saveError).toBeNull();
    expect(state.saveErrorPath).toBeNull();
    expect(state.saveErrorStatus).toBeNull();
  });

  it('preserves files array during manifest/loading transition', () => {
    const stateWithFiles: WorkspaceState = {
      ...initialState,
      files: [
        { path: 'specs/architecture.md', sizeBytes: 1024 },
        { path: 'specs/changelog.md', sizeBytes: 512 },
      ],
    };

    const state = workspaceReducer(stateWithFiles, {
      type: 'manifest/loading',
    });

    expect(state.files).toEqual([
      { path: 'specs/architecture.md', sizeBytes: 1024 },
      { path: 'specs/changelog.md', sizeBytes: 512 },
    ]);
    expect(state.manifestStatus).toBe('loading');
  });

  it('handles manifest/loading with undefined files gracefully', () => {
    const state = workspaceReducer(
      { ...initialState, files: undefined as any },
      { type: 'manifest/loading' },
    );

    expect(state.files).toEqual([]);
    expect(state.manifestStatus).toBe('loading');
  });
});
