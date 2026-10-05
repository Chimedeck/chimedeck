// SpecsWorkspacePage.test.tsx — workspace file selection and save/commit behavior.
// Sprint 170: checks manifest load, dirty tracking, conflict reload, and commit wiring.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SpecsWorkspacePage from '../../containers/SpecsWorkspacePage/SpecsWorkspacePage';
import * as apiClient from '~/common/api/client';

vi.mock('~/common/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

let editorMarkdown = '# Architecture';
let editorConfig: { onUpdate?: ({ editor }: { editor: typeof editorMock }) => void } | null = null;

const editorMock = {
  storage: {
    markdown: {
      getMarkdown: () => editorMarkdown,
    },
  },
  commands: {
    setContent: vi.fn((content: string) => {
      editorMarkdown = content;
    }),
  },
  setEditable: vi.fn(),
  isActive: vi.fn(() => false),
  chain: vi.fn(() => ({
    focus: () => ({
      toggleHeading: () => ({ run: vi.fn() }),
      toggleBold: () => ({ run: vi.fn() }),
      toggleItalic: () => ({ run: vi.fn() }),
      toggleCode: () => ({ run: vi.fn() }),
      toggleBulletList: () => ({ run: vi.fn() }),
      toggleOrderedList: () => ({ run: vi.fn() }),
      toggleCodeBlock: () => ({ run: vi.fn() }),
      toggleBlockquote: () => ({ run: vi.fn() }),
      setHorizontalRule: () => ({ run: vi.fn() }),
    }),
  })),
};

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn((config) => {
    editorConfig = config as typeof editorConfig;
    editorMarkdown = config.content as string;
    return editorMock;
  }),
  EditorContent: () => <div data-testid="editor-content" />,
}));

vi.mock('@tiptap/starter-kit', () => ({ default: {} }));
vi.mock('@tiptap/markdown', () => ({ Markdown: {} }));
vi.mock('@tiptap/extension-link', () => ({
  default: { configure: vi.fn(() => ({})) },
}));

const MOCK_MANIFEST = {
  ref: 'main',
  fetchedAt: '2026-06-01T00:00:00Z',
  etag: 'abc123',
  files: [
    { path: 'specs/architecture.md', sizeBytes: 1024 },
    { path: 'specs/changelog/2026-01.md', sizeBytes: 512 },
  ],
};

function mockResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function openArchitectureFile() {
  await waitFor(() => {
    expect(screen.getByText('architecture.md')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: /architecture\.md/i }));

  await waitFor(
    () => {
      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    },
    { timeout: 3000 }
  );
}

async function updateEditorMarkdown(nextContent: string) {
  await act(async () => {
    editorMarkdown = nextContent;
    editorConfig?.onUpdate?.({ editor: editorMock });
  });
}

describe('SpecsWorkspacePage', () => {
  const apiGet = apiClient.apiClient.get as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    editorConfig = null;
    editorMarkdown = '# Architecture';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the file tree and prompt after loading the manifest', async () => {
    apiGet.mockResolvedValue({ data: MOCK_MANIFEST });

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token" canEdit />);

    await waitFor(() => {
      expect(screen.getByText('architecture.md')).toBeInTheDocument();
    });
    expect(screen.getByText('Select a file to view it.')).toBeInTheDocument();
  });

  it('debounces save requests and clears the dirty badge after save succeeds', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url.includes('/specs/manifest')) {
        return { data: MOCK_MANIFEST };
      }
      return {
        data: { path: 'specs/architecture.md', content: '# Architecture', etag: 'file-etag-1' },
      };
    });
    const fetchMock = vi.fn(async () =>
      mockResponse({
        data: {
          path: 'specs/architecture.md',
          content: '# Updated',
          etag: 'file-etag-2',
          sha: 'file-etag-2',
          created: false,
        },
      })
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token" canEdit />);

    await openArchitectureFile();
    await updateEditorMarkdown('# Updated');

    await waitFor(() => {
      expect(screen.getByText('Unsaved')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 }
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/boards/board-1/github/specs/file');
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer token',
        'If-Match': 'file-etag-1',
      })
    );

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 4000 }
    );
  });

  it('shows a conflict banner and reloads the server copy after a stale save', async () => {
    let fileReads = 0;
    apiGet.mockImplementation(async (url: string) => {
      if (url.includes('/specs/manifest')) {
        return { data: MOCK_MANIFEST };
      }
      fileReads += 1;
      if (fileReads === 1) {
        return {
          data: { path: 'specs/architecture.md', content: '# Architecture', etag: 'file-etag-1' },
        };
      }
      return {
        data: { path: 'specs/architecture.md', content: '# Server copy', etag: 'file-etag-3' },
      };
    });

    const fetchMock = vi.fn(async () =>
      mockResponse(
        {
          name: 'stale-specs-file-precondition',
          data: { message: 'The file changed on the server. Reload and try again.' },
        },
        412
      )
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token" canEdit />);

    await openArchitectureFile();
    await updateEditorMarkdown('# Conflicting local change');

    await waitFor(
      () => {
        expect(screen.getAllByRole('button', { name: 'Reload file' }).length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );
    expect(screen.getAllByText(/The file changed on the server/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Reload file' })[0]);

    await waitFor(() => {
      expect(fileReads).toBeGreaterThanOrEqual(2);
    });
  });

  it('returns to a cached file without getting stuck in loading and keeps unsaved edits', async () => {
    let resolveChangelogRead: (() => void) | null = null;
    apiGet.mockImplementation((url: string) => {
      if (url.includes('/specs/manifest')) {
        return Promise.resolve({ data: MOCK_MANIFEST });
      }
      if (url.includes('architecture.md')) {
        return Promise.resolve({
          data: { path: 'specs/architecture.md', content: '# Architecture', etag: 'file-etag-1' },
        });
      }
      if (url.includes('2026-01.md')) {
        return new Promise((resolve) => {
          resolveChangelogRead = () => {
            resolve({
              data: {
                path: 'specs/changelog/2026-01.md',
                content: '# Changelog',
                etag: 'file-etag-2',
              },
            });
          };
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token" canEdit />);

    await openArchitectureFile();
    await updateEditorMarkdown('# Local architecture draft');
    await waitFor(() => {
      expect(screen.getByText('Unsaved')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '2026-01.md' }));
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /architecture\.md/i }));

    await waitFor(() => {
      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    });
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();

    await act(async () => {
      resolveChangelogRead?.();
    });
  });

  it('posts the changed file list to the commit endpoint', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url.includes('/specs/manifest')) {
        return { data: MOCK_MANIFEST };
      }
      return {
        data: { path: 'specs/architecture.md', content: '# Architecture', etag: 'file-etag-1' },
      };
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          data: {
            path: 'specs/architecture.md',
            content: '# Updated',
            etag: 'file-etag-2',
            sha: 'file-etag-2',
            created: false,
          },
        })
      )
      .mockResolvedValueOnce(
        mockResponse(
          {
            data: {
              commitHash: 'commit-sha-1',
              pushStatus: 'pushed',
              branch: 'main',
              changedFiles: ['specs/architecture.md'],
              footer: {
                actorId: 'user-1',
                boardId: 'board-1',
                botAlias: 'github-app[bot]',
              },
            },
          },
          201
        )
      );
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token" canEdit />);

    await openArchitectureFile();
    await updateEditorMarkdown('# Updated');
    const commitButton = screen.getByRole('button', { name: 'Commit changes' });
    expect(commitButton).toBeDisabled();

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 }
    );
    expect(commitButton).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('Commit message'), {
      target: { value: 'Update specs' },
    });
    fireEvent.click(commitButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [, commitInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(commitInit.method).toBe('POST');
    expect(commitInit.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer token',
      })
    );

    const commitBody = JSON.parse(commitInit.body as string) as {
      message: string;
      changedFiles: string[];
    };
    expect(commitBody.message).toBe('Update specs');
    expect(commitBody.changedFiles).toEqual(['specs/architecture.md']);

    await waitFor(() => {
      expect(screen.getByText('Commit created')).toBeInTheDocument();
    });
  });
});
