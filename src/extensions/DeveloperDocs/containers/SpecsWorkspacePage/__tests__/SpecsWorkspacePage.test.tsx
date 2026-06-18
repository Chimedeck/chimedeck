// SpecsWorkspacePage.test.tsx — component-level tests for dirty/save/commit UI.
// Sprint 170: covers "Unsaved" badge, "Saving…" badge, 412 conflict banner + Reload,
// commit button disabled-while-saving, and commit success feedback.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SpecsWorkspacePage from '../SpecsWorkspacePage';

// SpecsFileTree: renders clickable file names from the manifest.
vi.mock('../../../components/SpecsFileTree', () => ({
  default: ({ files, onSelect }: { files: { path: string }[]; onSelect: (p: string) => void }) => (
    <ul>
      {files.map((f) => (
        <li key={f.path}>
          <button
            onClick={() => {
              onSelect(f.path);
            }}
          >
            {f.path}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

// SpecsMarkdownEditor: exposes an onChange trigger so tests can simulate typing.
vi.mock('../../../components/SpecsMarkdownEditor', () => ({
  default: ({
    content,
    onChange,
    readOnly,
  }: {
    content: string;
    onChange: (v: string) => void;
    readOnly?: boolean;
  }) => (
    <div data-testid="markdown-editor">
      <span data-testid="editor-content">{content}</span>
      {!readOnly && (
        <button
          data-testid="editor-change"
          onClick={() => {
            onChange('edited content');
          }}
        >
          Type
        </button>
      )}
    </div>
  ),
}));

// apiClient.get is used for manifest + file loads.
const mockGet = vi.fn();
vi.mock('~/common/api/client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

// global fetch is used for save (PUT) and commit (POST).
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockGet.mockReset();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const MANIFEST_RESPONSE = {
  data: {
    ref: 'main',
    fetchedAt: '2025-01-01T00:00:00Z',
    etag: '"etag-manifest"',
    files: [{ path: 'specs/overview.md', type: 'blob', size: 100 }],
  },
};

const FILE_RESPONSE = {
  data: {
    path: 'specs/overview.md',
    content: '# Overview',
    etag: '"etag-v1"',
  },
};

async function renderAndOpenFile(canEdit = true) {
  mockGet.mockResolvedValueOnce(MANIFEST_RESPONSE).mockResolvedValueOnce(FILE_RESPONSE);

  render(<SpecsWorkspacePage boardId="board-1" accessToken="token-abc" canEdit={canEdit} />);

  // Wait for manifest to load and file tree to appear.
  await waitFor(() => screen.getByText('specs/overview.md'));
  fireEvent.click(screen.getByText('specs/overview.md'));

  // Wait for file content to load.
  await waitFor(() => screen.getByTestId('markdown-editor'));
}

describe('SpecsWorkspacePage — manifest error UX (403 not-configured / load-failed)', () => {
  function makeAxiosError(status: number, payload: { name: string; data: { message: string } }) {
    const err = new Error(`Request failed with status code ${status}`) as Error & {
      response: { status: number; data: typeof payload };
    };
    err.response = { status, data: payload };
    return err;
  }

  it('shows the "configure your Github documentation" hint when the board has no URL configured (403)', async () => {
    mockGet.mockRejectedValueOnce(
      makeAxiosError(403, {
        name: 'specs-not-configured',
        data: { message: 'You must configure your Github documentation respository first' },
      })
    );

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token-abc" canEdit />);

    await waitFor(() =>
      expect(
        screen.getByText('You must configure your Github documentation respository first')
      ).toBeInTheDocument()
    );

    // No "Retry" button is offered for the not-configured case.
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('shows the "do not have access" hint when the repo cannot be cloned (403)', async () => {
    mockGet.mockRejectedValueOnce(
      makeAxiosError(403, {
        name: 'specs-load-failed',
        data: { message: 'Our app do not have access to this respository' },
      })
    );

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token-abc" canEdit />);

    await waitFor(() =>
      expect(screen.getByText('Our app do not have access to this respository')).toBeInTheDocument()
    );

    // Retry button is still available — the failure may be transient.
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('SpecsWorkspacePage — save/commit UI', () => {
  it('shows "Saved" badge after file loads with no edits', async () => {
    await renderAndOpenFile();
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('shows "Unsaved" badge after editor content changes', async () => {
    await renderAndOpenFile();
    fireEvent.click(screen.getByTestId('editor-change'));
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
  });

  it('shows "Saving…" badge while save request is in-flight', async () => {
    // Never resolves — keeps request pending.
    mockFetch.mockReturnValue(new Promise(() => {}));

    await renderAndOpenFile();
    fireEvent.click(screen.getByTestId('editor-change'));

    // Wait for the debounced autosave to fire (600ms + buffer).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });

    await waitFor(() => expect(screen.getByText('Saving…')).toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it('shows "Conflict" badge and "Reload file" button on 412 response', async () => {
    const conflictError = Object.assign(new Error('File was modified remotely.'), { status: 412 });
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 412,
        json: async () => ({ data: { message: 'File was modified remotely.' } }),
      })
    );

    await renderAndOpenFile();
    fireEvent.click(screen.getByTestId('editor-change'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });

    await waitFor(() => expect(screen.getByText('Conflict')).toBeInTheDocument(), {
      timeout: 2000,
    });

    // "File conflict detected" banner with "Reload file" action.
    expect(screen.getByText('File conflict detected')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reload file' }).length).toBeGreaterThan(0);
  });

  it('"Commit changes" button is disabled while isSaving is true', async () => {
    // Keep save pending.
    mockFetch.mockReturnValue(new Promise(() => {}));

    await renderAndOpenFile();
    fireEvent.click(screen.getByTestId('editor-change'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });

    await waitFor(
      () => {
        const btn = screen.getByRole('button', { name: 'Commit changes' });
        expect(btn).toBeDisabled();
      },
      { timeout: 2000 }
    );
  });

  it('shows "Commit created" after a successful commit', async () => {
    // First call = save success, second = commit success.
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            path: 'specs/overview.md',
            content: 'edited content',
            etag: '"etag-v2"',
            sha: 'abc',
            created: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            commitHash: 'deadbeef',
            pushStatus: 'pushed',
            branch: 'main',
            changedFiles: ['specs/overview.md'],
            footer: { actorId: 'u1', boardId: 'board-1', botAlias: 'copilot-bot' },
          },
        }),
      });

    await renderAndOpenFile();
    fireEvent.click(screen.getByTestId('editor-change'));

    // Wait for autosave to complete (save debounce + response).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800));
    });

    await waitFor(() => expect(screen.getByText('Ready to commit')).toBeInTheDocument(), {
      timeout: 2000,
    });

    // Fill in commit message and click commit.
    fireEvent.change(screen.getByPlaceholderText('Update specs'), {
      target: { value: 'chore: update overview' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Commit changes' }));

    await waitFor(() => expect(screen.getByText('Commit created')).toBeInTheDocument(), {
      timeout: 2000,
    });
  });
});
