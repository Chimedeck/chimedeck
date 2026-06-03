// SpecsWorkspacePage.test.tsx — workspace file selection and save/commit behavior.
// Sprint 170: checks manifest load, dirty tracking, conflict reload, and commit wiring.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    vi.unstubAllGlobals();
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
    vi.useFakeTimers();
    apiGet
      .mockResolvedValueOnce({ data: MOCK_MANIFEST })
      .mockResolvedValueOnce({
        data: { path: 'specs/architecture.md', content: '# Architecture', etag: 'file-etag-1' },
      });
    const fetchMock = vi.fn(async () => mockResponse({
      data: {
        path: 'specs/architecture.md',
        content: '# Updated',
        etag: 'file-etag-2',
        sha: 'file-etag-2',
        created: false,
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token" canEdit />);

    await waitFor(() => {
      expect(screen.getByText('architecture.md')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('architecture.md'));

    await waitFor(() => {
      expect(screen.getByTitle('specs/architecture.md')).toBeInTheDocument();
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();

    editorMarkdown = '# Updated';
    editorConfig?.onUpdate?.({ editor: editorMock });

    expect(screen.getByText('Unsaved')).toBeInTheDocument();

    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/boards/board-1/github/specs/file');
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer token',
        'If-Match': 'file-etag-1',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('Ready to commit')).toBeInTheDocument();
    });
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
  });

  it('shows a conflict banner and reloads the server copy after a stale save', async () => {
    vi.useFakeTimers();
    apiGet
      .mockResolvedValueOnce({ data: MOCK_MANIFEST })
      .mockResolvedValueOnce({
        data: { path: 'specs/architecture.md', content: '# Architecture', etag: 'file-etag-1' },
      })
      .mockResolvedValueOnce({
        data: { path: 'specs/architecture.md', content: '# Server copy', etag: 'file-etag-3' },
      });

    const fetchMock = vi.fn(async () => mockResponse({
      name: 'stale-specs-file-precondition',
      data: { message: 'The file changed on the server. Reload and try again.' },
    }, 412));
    vi.stubGlobal('fetch', fetchMock);

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token" canEdit />);

    await waitFor(() => {
      expect(screen.getByText('architecture.md')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('architecture.md'));

    await waitFor(() => {
      expect(screen.getByTitle('specs/architecture.md')).toBeInTheDocument();
    });

    editorMarkdown = '# Conflicting local change';
    editorConfig?.onUpdate?.({ editor: editorMock });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByText('Conflict')).toBeInTheDocument();
    });
    expect(screen.getByText(/The file changed on the server/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reload file' }));

    await waitFor(() => {
      expect(editorMock.commands.setContent).toHaveBeenCalledWith('# Server copy');
    });
  });

  it('posts the changed file list to the commit endpoint', async () => {
    vi.useFakeTimers();
    apiGet
      .mockResolvedValueOnce({ data: MOCK_MANIFEST })
      .mockResolvedValueOnce({
        data: { path: 'specs/architecture.md', content: '# Architecture', etag: 'file-etag-1' },
      });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({
        data: {
          path: 'specs/architecture.md',
          content: '# Updated',
          etag: 'file-etag-2',
          sha: 'file-etag-2',
          created: false,
        },
      }))
      .mockResolvedValueOnce(mockResponse({
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
      }, 201));
    vi.stubGlobal('fetch', fetchMock);

    render(<SpecsWorkspacePage boardId="board-1" accessToken="token" canEdit />);

    await waitFor(() => {
      expect(screen.getByText('architecture.md')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('architecture.md'));

    await waitFor(() => {
      expect(screen.getByTitle('specs/architecture.md')).toBeInTheDocument();
    });

    editorMarkdown = '# Updated';
    editorConfig?.onUpdate?.({ editor: editorMock });
    vi.advanceTimersByTime(600);

    await waitFor(() => {
      expect(screen.getByText('Ready to commit')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Commit message'), { target: { value: 'Update specs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Commit changes' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [, commitInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(commitInit.method).toBe('POST');
    expect(commitInit.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer token',
      }),
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
