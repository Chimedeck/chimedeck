// BoardSettings.githubProjectUrl.test.tsx — test GitHub Project URL setting.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GithubProjectUrlSetting from '../GithubProjectUrlSetting';
import * as BoardAPI from '../../../api';

// Mock API calls
vi.mock('../../../api', () => ({
  getBoardIntegrations: vi.fn(),
  patchBoardIntegrations: vi.fn(),
}));

// Mock apiClient
vi.mock('~/common/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('GithubProjectUrlSetting', () => {
  const boardId = 'test-board-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should load initial value from API', async () => {
      const initialUrl = 'https://github.com/orgs/example/projects/1';
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: initialUrl },
      });

      render(<GithubProjectUrlSetting boardId={boardId} />);

      // Should show loading state initially
      expect(screen.getByRole('textbox')).toBeDisabled();

      await waitFor(() => {
        expect(vi.mocked(BoardAPI.getBoardIntegrations)).toHaveBeenCalledWith({
          api: expect.any(Object),
          boardId,
        });
      });

      // Should display the loaded URL
      expect(screen.getByDisplayValue(initialUrl)).toBeInTheDocument();
    });

    it('should show empty state when no initial value', async () => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });

      render(<GithubProjectUrlSetting boardId={boardId} />);

      await waitFor(() => {
        const input = screen.getByRole('textbox') as HTMLInputElement;
        expect(input.value).toBe('');
      });
    });

    it('should show error on load failure', async () => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockRejectedValue(new Error('Load failed'));

      render(<GithubProjectUrlSetting boardId={boardId} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load GitHub Project URL')).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    beforeEach(() => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });
    });

    it('should show disabled state with unauthorized message', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={true} />);

      await waitFor(() => {
        expect(screen.getByText('Only board admins can edit this setting')).toBeInTheDocument();
        const input = screen.getByRole('textbox');
        expect(input).toBeDisabled();
      });
    });

    it('should not show save button when disabled', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={true} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      });
    });

    it('should prevent input changes when disabled', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={true} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      await waitFor(() => {
        expect(input.disabled).toBe(true);
      });
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });
    });

    it('should accept valid GitHub project URLs', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/orgs/example/projects/1');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid GitHub project URL')).not.toBeInTheDocument();
      });
    });

    it('should reject invalid URLs on blur', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://invalid.com/project');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid GitHub project URL')).toBeInTheDocument();
      });
    });

    it('should accept user-scoped project URLs', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/users/john/projects/42');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid GitHub project URL')).not.toBeInTheDocument();
      });
    });

    it('should allow URLs with trailing slash', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/orgs/example/projects/1/');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid GitHub project URL')).not.toBeInTheDocument();
      });
    });
  });

  describe('Save Flow', () => {
    beforeEach(() => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });
    });

    it('should save valid URL', async () => {
      vi.mocked(BoardAPI.patchBoardIntegrations).mockResolvedValue({
        data: { github_project_url: 'https://github.com/orgs/example/projects/1' },
      });

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/orgs/example/projects/1');

      const saveButton = await screen.findByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(BoardAPI.patchBoardIntegrations)).toHaveBeenCalledWith({
          api: expect.any(Object),
          boardId,
          settings: { github_project_url: 'https://github.com/orgs/example/projects/1' },
        });
      });
    });

    it('should normalize URL by removing trailing slash', async () => {
      vi.mocked(BoardAPI.patchBoardIntegrations).mockResolvedValue({
        data: { github_project_url: 'https://github.com/orgs/example/projects/1' },
      });

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/orgs/example/projects/1/');

      const saveButton = await screen.findByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(BoardAPI.patchBoardIntegrations)).toHaveBeenCalledWith(
          expect.objectContaining({
            settings: { github_project_url: 'https://github.com/orgs/example/projects/1' },
          }),
        );
      });
    });

    it('should show error on save failure and rollback', async () => {
      vi.mocked(BoardAPI.patchBoardIntegrations).mockRejectedValue(new Error('Save failed'));

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/orgs/example/projects/1');

      const saveButton = await screen.findByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save GitHub Project URL')).toBeInTheDocument();
        expect(input).toHaveValue(''); // Rolled back to empty
      });
    });

    it('should disable input while saving', async () => {
      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });
      vi.mocked(BoardAPI.patchBoardIntegrations).mockReturnValue(requestPromise as any);

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/orgs/example/projects/1');

      const saveButton = await screen.findByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      // Input should be disabled while saving
      expect(input).toBeDisabled();
      expect(saveButton).toHaveTextContent('Saving…');

      resolveRequest!();
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });
  });

  describe('Clear Flow', () => {
    beforeEach(() => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: 'https://github.com/orgs/example/projects/1' },
      });
    });

    it('should show clear button when URL is present', async () => {
      vi.mocked(BoardAPI.patchBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
      });
    });

    it('should send null to clear setting', async () => {
      vi.mocked(BoardAPI.patchBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /clear/i });
        expect(clearButton).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await userEvent.click(clearButton);

      await waitFor(() => {
        expect(vi.mocked(BoardAPI.patchBoardIntegrations)).toHaveBeenCalledWith(
          expect.objectContaining({
            settings: { github_project_url: null },
          }),
        );
      });
    });

    it('should hide clear button while saving', async () => {
      let resolveRequest: () => void;
      const requestPromise = new Promise<void>((resolve) => {
        resolveRequest = resolve;
      });
      vi.mocked(BoardAPI.patchBoardIntegrations).mockReturnValue(requestPromise as any);

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      await userEvent.click(clearButton);

      // Clear button should disappear while saving
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();

      resolveRequest!();
      await waitFor(() => {
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });
    });

    it('should have proper ARIA labels', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = await screen.findByLabelText('GitHub Project URL');
      expect(input).toBeInTheDocument();
    });

    it('should have descriptive helper text', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      await waitFor(() => {
        expect(screen.getByText('Link this board to a GitHub project for better integration')).toBeInTheDocument();
      });
    });
  });
});
