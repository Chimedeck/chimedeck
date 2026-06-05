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
        expect(screen.getByText('Failed to load GitHub URL')).toBeInTheDocument();
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
        expect(screen.queryByText('Please enter a valid GitHub project or repository URL')).not.toBeInTheDocument();
      });
    });

    it('should reject invalid URLs on blur', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://invalid.com/project');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid GitHub project or repository URL')).toBeInTheDocument();
      });
    });

    it('should accept user-scoped project URLs', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/users/john/projects/42');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid GitHub project or repository URL')).not.toBeInTheDocument();
      });
    });

    it('should allow URLs with trailing slash', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/orgs/example/projects/1/');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid GitHub project or repository URL')).not.toBeInTheDocument();
      });
    });

    it('should accept an HTTPS repository URL', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://github.com/journeyhorizon/sample-agentic-project.git');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid GitHub project or repository URL')).not.toBeInTheDocument();
      });
    });

    it('should accept an SSH clone URL', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'git@github.com:journeyhorizon/sample-agentic-project.git');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.queryByText('Please enter a valid GitHub project or repository URL')).not.toBeInTheDocument();
      });
    });

    it('should still reject completely unrelated URLs', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'https://example.com/owner/repo.git');
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid GitHub project or repository URL')).toBeInTheDocument();
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
        expect(screen.getByText('Failed to save GitHub URL')).toBeInTheDocument();
        // The input should be rolled back to the value the user typed before
        // the failed save (not the empty initial value).
        expect(input).toHaveValue('https://github.com/orgs/example/projects/1');
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

      const input = await screen.findByLabelText('GitHub URL');
      expect(input).toBeInTheDocument();
    });

    it('should have descriptive helper text', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

      await waitFor(() => {
        // [why] The helper is split into a sentence + a monospace examples
        // block + a follow-up hint.  We assert on the stable sentence so the
        // test is robust to copy tweaks in the example / hint rows.
        expect(
          screen.getByText('Link this board to a GitHub project or repository for better integration.'),
        ).toBeInTheDocument();
        // Examples should be rendered in a monospace block.
        expect(
          screen.getByText(/https:\/\/github\.com\/orgs\/<owner>\/projects\/<n>/),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Save button enablement after blur (regression: #save-disabled-after-blur)', () => {
    beforeEach(() => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });
    });

    // [why] The previous implementation computed `disabled` from a combination
    // of `isFocused` and `isValidationError`, which meant that as soon as the
    // user blurred a valid URL, the Save button would re-disable.  These
    // tests pin down the corrected behaviour across the three supported URL
    // shapes.

    const sampleUrls: ReadonlyArray<{ label: string; value: string }> = [
      { label: 'project URL', value: 'https://github.com/orgs/example/projects/1' },
      { label: 'HTTPS repo URL', value: 'https://github.com/journeyhorizon/sample-agentic-project.git' },
      { label: 'SSH clone URL', value: 'git@github.com:journeyhorizon/sample-agentic-project.git' },
    ];

    for (const { label, value } of sampleUrls) {
      it(`keeps Save enabled after blur for a valid ${label}`, async () => {
        render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);

        const input = await screen.findByRole('textbox');
        await userEvent.click(input);
        await userEvent.clear(input);
        await userEvent.type(input, value);
        // Explicit blur to leave the input — reproduces the bug from the
        // previous implementation, where blur forced `isFocused` to false.
        fireEvent.blur(input);

        const saveButton = screen.getByTestId('github-project-url-save');
        expect(saveButton).not.toBeDisabled();
      });
    }
  });

  describe('Parsed owner/repository display', () => {
    beforeEach(() => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });
    });

    it('shows the parsed owner/repo for an org project URL', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);
      const input = await screen.findByRole('textbox');
      await userEvent.type(input, 'https://github.com/orgs/example/projects/7');

      await waitFor(() => {
        expect(screen.getByTestId('github-project-url-parsed-value')).toHaveTextContent(
          'example · project #7',
        );
      });
    });

    it('shows the parsed owner/repo for an HTTPS repo URL', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);
      const input = await screen.findByRole('textbox');
      await userEvent.type(input, 'https://github.com/journeyhorizon/sample-agentic-project.git');

      await waitFor(() => {
        expect(screen.getByTestId('github-project-url-parsed-value')).toHaveTextContent(
          'journeyhorizon/sample-agentic-project',
        );
      });
    });

    it('shows the parsed owner/repo for an SSH clone URL', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);
      const input = await screen.findByRole('textbox');
      await userEvent.type(input, 'git@github.com:journeyhorizon/sample-agentic-project.git');

      await waitFor(() => {
        expect(screen.getByTestId('github-project-url-parsed-value')).toHaveTextContent(
          'journeyhorizon/sample-agentic-project',
        );
      });
    });

    it('does not show the parsed chip while the URL is invalid', async () => {
      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);
      const input = await screen.findByRole('textbox');
      await userEvent.type(input, 'not a real url');

      expect(screen.queryByTestId('github-project-url-parsed-value')).not.toBeInTheDocument();
    });
  });

  describe('Save payload normalisation', () => {
    beforeEach(() => {
      vi.mocked(BoardAPI.getBoardIntegrations).mockResolvedValue({
        data: { github_project_url: null },
      });
    });

    it('strips the .git suffix from an HTTPS repo URL when saving', async () => {
      vi.mocked(BoardAPI.patchBoardIntegrations).mockResolvedValue({
        data: { github_project_url: 'https://github.com/journeyhorizon/sample-agentic-project' },
      });

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);
      const input = await screen.findByRole('textbox');
      await userEvent.type(input, 'https://github.com/journeyhorizon/sample-agentic-project.git');

      const saveButton = screen.getByTestId('github-project-url-save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(BoardAPI.patchBoardIntegrations)).toHaveBeenCalledWith(
          expect.objectContaining({
            settings: {
              github_project_url: 'https://github.com/journeyhorizon/sample-agentic-project',
            },
          }),
        );
      });
    });

    it('rewrites an SSH clone URL to canonical HTTPS when saving', async () => {
      vi.mocked(BoardAPI.patchBoardIntegrations).mockResolvedValue({
        data: { github_project_url: 'https://github.com/journeyhorizon/sample-agentic-project' },
      });

      render(<GithubProjectUrlSetting boardId={boardId} disabled={false} />);
      const input = await screen.findByRole('textbox');
      await userEvent.type(input, 'git@github.com:journeyhorizon/sample-agentic-project.git');

      const saveButton = screen.getByTestId('github-project-url-save');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(BoardAPI.patchBoardIntegrations)).toHaveBeenCalledWith(
          expect.objectContaining({
            settings: {
              github_project_url: 'https://github.com/journeyhorizon/sample-agentic-project',
            },
          }),
        );
      });
    });
  });
});
