import { describe, it, expect } from 'vitest';
import {
  workspaceReducer,
  initialState as baseInitialState,
} from '../SpecsWorkspacePage';

type WorkspaceState = Parameters<typeof workspaceReducer>[0];
type WorkspaceAction = Parameters<typeof workspaceReducer>[1];

function cloneInitialState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    ...baseInitialState,
    dirtyPaths: new Set(baseInitialState.dirtyPaths),
    pendingCommitPaths: new Set(baseInitialState.pendingCommitPaths),
    ...overrides,
  };
}

function reduce(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  return workspaceReducer(state, action);
}

describe('SpecsWorkspacePage reducer', () => {
  it('records a stale save conflict (412 status)', () => {
    const state = reduce(cloneInitialState(), {
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
    const stateWithConflict = cloneInitialState({
      saveError: 'The file changed on the server. Reload and try again.',
      saveErrorPath: 'specs/architecture.md',
      saveErrorStatus: 412,
    });

    const state = reduce(stateWithConflict, { type: 'save/conflict-clear' });

    expect(state.saveError).toBeNull();
    expect(state.saveErrorPath).toBeNull();
    expect(state.saveErrorStatus).toBeNull();
  });

  it('removes a file from pending commit while local edits are unsaved', () => {
    const state = reduce(cloneInitialState({
      savedContent: { 'specs/architecture.md': '# Saved' },
      editorContent: { 'specs/architecture.md': '# Saved' },
      pendingCommitPaths: new Set(['specs/architecture.md']),
      lastSaveAttemptContent: { 'specs/architecture.md': '# Saved' },
    }), {
      type: 'editor/change',
      path: 'specs/architecture.md',
      content: '# Unsaved draft',
    });

    expect(state.dirtyPaths.has('specs/architecture.md')).toBe(true);
    expect(state.pendingCommitPaths.has('specs/architecture.md')).toBe(false);
  });

  it('restores pending commit state when content returns to the last saved value', () => {
    const dirtyState = cloneInitialState({
      savedContent: { 'specs/architecture.md': '# Saved' },
      editorContent: { 'specs/architecture.md': '# Unsaved draft' },
      dirtyPaths: new Set(['specs/architecture.md']),
      pendingCommitPaths: new Set(),
      lastSaveAttemptContent: { 'specs/architecture.md': '# Saved' },
    });

    const state = reduce(dirtyState, {
      type: 'editor/change',
      path: 'specs/architecture.md',
      content: '# Saved',
    });

    expect(state.dirtyPaths.has('specs/architecture.md')).toBe(false);
    expect(state.pendingCommitPaths.has('specs/architecture.md')).toBe(true);
  });

  it('clears only committed files from pendingCommitPaths on commit/success', () => {
    const state = reduce(cloneInitialState({
      commitStatus: 'committing',
      commitMessage: 'Update specs',
      pendingCommitPaths: new Set(['specs/architecture.md', 'specs/changelog.md']),
      savedContent: {
        'specs/architecture.md': '# Architecture',
        'specs/changelog.md': '# Changelog',
      },
      lastSaveAttemptContent: {
        'specs/architecture.md': '# Architecture',
        'specs/changelog.md': '# Changelog',
      },
    }), {
      type: 'commit/success',
      changedFiles: ['specs/architecture.md'],
    });

    expect(state.commitStatus).toBe('success');
    expect(state.commitMessage).toBe('');
    expect(state.pendingCommitPaths.has('specs/architecture.md')).toBe(false);
    expect(state.pendingCommitPaths.has('specs/changelog.md')).toBe(true);
  });

  it('clears dirtyPaths and adds to pendingCommitPaths on save/success when editor matches saved', () => {
    const dirtyState = cloneInitialState({
      selectedPath: 'specs/overview.md',
      savedContent: { 'specs/overview.md': '# Original' },
      savedEtags: { 'specs/overview.md': '"etag-v1"' },
      editorContent: { 'specs/overview.md': '# Edited' },
      dirtyPaths: new Set(['specs/overview.md']),
      pendingCommitPaths: new Set(),
      isSaving: true,
    });

    const state = reduce(dirtyState, {
      type: 'save/success',
      path: 'specs/overview.md',
      content: '# Edited',
      etag: '"etag-v2"',
      sha: 'abc123',
      created: false,
    });

    expect(state.isSaving).toBe(false);
    // dirtyPaths cleared because editor content matches saved content.
    expect(state.dirtyPaths.has('specs/overview.md')).toBe(false);
    // Path is now ready to commit.
    expect(state.pendingCommitPaths.has('specs/overview.md')).toBe(true);
    expect(state.savedContent['specs/overview.md']).toBe('# Edited');
    expect(state.savedEtags['specs/overview.md']).toBe('"etag-v2"');
  });

  it('leaves dirtyPaths intact on save/success when editor has newer edits', () => {
    const dirtyState = cloneInitialState({
      selectedPath: 'specs/overview.md',
      savedContent: { 'specs/overview.md': '# Original' },
      savedEtags: { 'specs/overview.md': '"etag-v1"' },
      // User typed more after save was initiated
      editorContent: { 'specs/overview.md': '# Newer edits' },
      dirtyPaths: new Set(['specs/overview.md']),
      pendingCommitPaths: new Set(),
      isSaving: true,
    });

    const state = reduce(dirtyState, {
      type: 'save/success',
      path: 'specs/overview.md',
      // save/success carries the content that was saved (an older snapshot)
      content: '# Edited snapshot',
      etag: '"etag-v2"',
      sha: 'abc123',
      created: false,
    });

    // dirtyPaths stays because editor still has newer edits
    expect(state.dirtyPaths.has('specs/overview.md')).toBe(true);
    // Not ready to commit yet
    expect(state.pendingCommitPaths.has('specs/overview.md')).toBe(false);
  });
});

describe('SpecsWorkspacePage reducer — manifest error metadata', () => {
  it('records name + status alongside the error message on manifest/error', () => {
    const state = reduce(cloneInitialState(), {
      type: 'manifest/error',
      message: 'You must configure your Github documentation respository first',
      name: 'specs-not-configured',
      status: 403,
    });

    expect(state.manifestError).toContain('configure your Github documentation');
    expect(state.manifestErrorName).toBe('specs-not-configured');
    expect(state.manifestErrorStatus).toBe(403);
    expect(state.manifestStatus).toBe('error');
  });

  it('clears the manifest error fields on manifest/loading', () => {
    const stateWithError = cloneInitialState({
      manifestStatus: 'error',
      manifestError: 'You must configure your Github documentation respository first',
      manifestErrorName: 'specs-not-configured',
      manifestErrorStatus: 403,
    });

    const state = reduce(stateWithError, { type: 'manifest/loading' });

    expect(state.manifestError).toBeNull();
    expect(state.manifestErrorName).toBeNull();
    expect(state.manifestErrorStatus).toBeNull();
    expect(state.manifestStatus).toBe('loading');
  });
});
