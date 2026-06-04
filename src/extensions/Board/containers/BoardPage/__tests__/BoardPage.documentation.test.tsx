// BoardPage.documentation.test.tsx — Documentation tab visibility and behavior.
// Sprint 170: tab appears when board has a valid GitHub Project URL, hidden otherwise.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import BoardPage from '../BoardPage';
import * as BoardAPI from '../../../api';

// Mock the board integrations API
vi.mock('../../../api', () => ({
  getBoardIntegrations: vi.fn(),
  updateBoard: vi.fn(),
  archiveBoard: vi.fn(),
  deleteBoard: vi.fn(),
  starBoard: vi.fn(),
  unstarBoard: vi.fn(),
  updateBoardVisibility: vi.fn(),
}));

// Mock SpecsWorkspacePage so tests don't need real TipTap / fetch
vi.mock('~/extensions/DeveloperDocs/containers/SpecsWorkspacePage/SpecsWorkspacePage', () => ({
  default: ({ boardId }: { boardId: string }) => (
    <div data-testid="specs-workspace">Specs Workspace for board {boardId}</div>
  ),
}));

// Mock heavy sub-components that require their own Redux state slices
vi.mock('../../../components/BoardCanvas', () => ({
  default: () => <div data-testid="board-canvas" />,
}));
vi.mock('../../../../Card/containers/CardModal', () => ({
  default: () => null,
}));
vi.mock('~/extensions/Plugins/iframeHost/PluginIframeContainer', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('~/extensions/HealthCheck/containers/HealthCheckTab/HealthCheckTab', () => ({
  default: () => <div data-testid="health-check-tab" />,
}));
vi.mock('~/extensions/BoardChat', () => ({
  BoardChatDrawer: () => null,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: vi.fn(() => ({ boardId: 'board-1', cardId: undefined })),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

vi.mock('~/extensions/HealthCheck/config/healthCheckConfig', () => ({
  HEALTH_CHECK_ENABLED: true,
  HEALTH_CHECK_POLL_INTERVAL_MS: 60_000,
}));

vi.mock('../../../config/boardChatConfig', () => ({
  BOARD_CHAT_ENABLED: false,
}));

vi.mock('../../../realtime.ts', () => ({}));
vi.mock('~/extensions/Realtime/hooks/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({ connectionState: 'connected', pollingActive: false })),
}));
vi.mock('~/extensions/Realtime/hooks/useBoardSync', () => ({
  useBoardSync: vi.fn(() => ({ handleEvent: vi.fn(), lastSequence: 0 })),
}));
vi.mock('~/extensions/Realtime/PollingFallback', () => ({
  usePollingFallback: vi.fn(),
}));
vi.mock('~/extensions/Notification/slices/notificationSlice', () => ({
  markReadThunk: vi.fn(() => ({ type: 'notification/markRead' })),
  selectNotifications: vi.fn(() => []),
}));

vi.mock('../../../slices/boardMembersSlice', () => ({
  useGetBoardMembersQuery: vi.fn(() => ({ data: [] })),
}));

function makeMockStore() {
  return configureStore({
    reducer: {
      board: () => ({
        board: { id: 'board-1', title: 'Test Board', state: 'ACTIVE', workspaceId: 'ws-1' },
        lists: {},
        listOrder: [],
        cards: {},
        cardsByList: {},
        status: 'loaded',
      }),
      auth: () => ({
        token: 'token',
        user: { id: 'user-1' },
      }),
      workspaceShell: () => ({
        activeWorkspaceId: 'ws-1',
        workspaces: [{ id: 'ws-1', name: 'Workspace', callerRole: 'ADMIN', createdAt: '2026-01-01' }],
        status: 'idle',
        createInProgress: false,
        createError: null,
      }),
      boardMembersApi: () => ({}),
      notifications: () => ({ notifications: [] }),
      viewPreference: () => ({ activeView: 'KANBAN', status: 'idle' }),
    },
  });
}

describe('BoardPage — Documentation tab', () => {
  let mockStore: ReturnType<typeof makeMockStore>;

  beforeEach(() => {
    mockStore = makeMockStore();
    vi.clearAllMocks();
  });

  it('does not show Documentation tab when board has no GitHub Project URL', async () => {
    (BoardAPI.getBoardIntegrations as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { github_project_url: null },
    });

    render(
      <MemoryRouter>
        <Provider store={mockStore}>
          <BoardPage />
        </Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Documentation' })).not.toBeInTheDocument();
    });
  });

  it('shows Documentation tab when board has a valid GitHub Project URL', async () => {
    (BoardAPI.getBoardIntegrations as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { github_project_url: 'https://github.com/org/repo' },
    });

    render(
      <MemoryRouter>
        <Provider store={mockStore}>
          <BoardPage />
        </Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Documentation' })).toBeInTheDocument();
    });
  });

  it('Documentation tab appears directly after Health Check tab', async () => {
    (BoardAPI.getBoardIntegrations as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { github_project_url: 'https://github.com/org/repo' },
    });

    render(
      <MemoryRouter>
        <Provider store={mockStore}>
          <BoardPage />
        </Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const tabs = screen.getAllByRole('button').filter((btn) =>
        ['Board', 'Activities', 'Archived Cards', 'Health Check', 'Documentation'].includes(btn.textContent ?? ''),
      );
      const tabLabels = tabs.map((t) => t.textContent);
      const healthCheckIdx = tabLabels.indexOf('Health Check');
      const docsIdx = tabLabels.indexOf('Documentation');
      expect(healthCheckIdx).toBeGreaterThanOrEqual(0);
      expect(docsIdx).toBe(healthCheckIdx + 1);
    });
  });

  it('clicking Documentation tab renders the SpecsWorkspacePage', async () => {
    (BoardAPI.getBoardIntegrations as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { github_project_url: 'https://github.com/org/repo' },
    });

    render(
      <MemoryRouter>
        <Provider store={mockStore}>
          <BoardPage />
        </Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Documentation' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Documentation' }));

    await waitFor(() => {
      expect(screen.getByTestId('specs-workspace')).toBeInTheDocument();
    });
  });

  it('hides Documentation tab when integrations fetch fails', async () => {
    (BoardAPI.getBoardIntegrations as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <Provider store={mockStore}>
          <BoardPage />
        </Provider>
      </MemoryRouter>,
    );

    // Wait for any async effects to settle
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Documentation' })).not.toBeInTheDocument();
    });
  });

  it('hides Documentation tab when github_project_url is an empty string', async () => {
    (BoardAPI.getBoardIntegrations as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { github_project_url: '' },
    });

    render(
      <MemoryRouter>
        <Provider store={mockStore}>
          <BoardPage />
        </Provider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Documentation' })).not.toBeInTheDocument();
    });
  });
});
