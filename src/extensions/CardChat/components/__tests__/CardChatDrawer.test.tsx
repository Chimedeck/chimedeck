import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CardChatDrawer from '../CardChatDrawer';
import * as useCardChatHistoryModule from '../../../CardChat/hooks/useCardChatHistory';
import * as cardChatApiModule from '../../../CardChat/api';

// [why] jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

vi.mock('../../../CardChat/hooks/useCardChatHistory', () => ({
  useCardChatHistory: vi.fn(() => ({
    messages: [],
    state: 'loading',
    isLoading: true,
    isEmpty: false,
    error: undefined,
  })),
}));

vi.mock('../../../CardChat/api', () => ({
  createCardChatMessage: vi.fn(async () => ({ data: {} })),
  pauseCardChatSession: vi.fn(async () => ({ data: {} })),
  refineCardChat: vi.fn(async () => ({
    data: {
      assistantMessage: {
        id: 'm-refine',
        session_id: 'sess-1',
        role: 'assistant',
        content: 'Here are the refined requirements...',
        metadata: null,
        author_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      session: {
        id: 'sess-1',
        card_id: 'card-1',
        workspace_id: 'ws-1',
        created_by: 'user-1',
        status: 'READY_FOR_REVIEW',
        quality_score: 92,
        last_actor_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      qualityScore: {
        earsCoverage: 23,
        acceptanceCriteria: 24,
        constraintClarity: 22,
        testability: 23,
        ambiguityPenalty: 0,
        total: 92,
      },
      loopComplete: true,
    },
  })),
}));

vi.mock('~/common/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const makeSession = (
  overrides: Partial<{
    id: string;
    card_id: string;
    workspace_id: string;
    created_by: string;
    status: 'ACTIVE_REFINEMENT' | 'PAUSED' | 'READY_FOR_REVIEW';
    quality_score: number | null;
    last_actor_at: string;
    created_at: string;
    updated_at: string;
  }> = {}
) => ({
  id: 'sess-1',
  card_id: 'card-1',
  workspace_id: 'ws-1',
  created_by: 'user-1',
  status: 'ACTIVE_REFINEMENT' as const,
  quality_score: 75,
  last_actor_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('CardChatDrawer', () => {
  const mockOnClose = vi.fn();
  const activeSession = makeSession();

  beforeEach(() => {
    vi.clearAllMocks();
    (
      useCardChatHistoryModule.useCardChatHistory as unknown as {
        mockReturnValue: (v: unknown) => void;
      }
    ).mockReturnValue({
      messages: [],
      state: 'loading',
      isLoading: true,
      isEmpty: false,
      error: undefined,
    });
  });

  it('renders the drawer with header and title', () => {
    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    expect(screen.getByText('AI Assist')).toBeInTheDocument();
    expect(screen.getByLabelText('Close card chat')).toBeInTheDocument();
  });

  it('displays loading state when history is loading', () => {
    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    expect(screen.getByText('Loading messages…')).toBeInTheDocument();
  });

  it('displays empty state when there are no messages', () => {
    (
      useCardChatHistoryModule.useCardChatHistory as unknown as {
        mockReturnValue: (v: unknown) => void;
      }
    ).mockReturnValue({
      messages: [],
      state: 'empty',
      isLoading: false,
      isEmpty: true,
      error: undefined,
    });

    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    expect(screen.getByText(/Start the conversation/)).toBeInTheDocument();
  });

  it('displays error state when history fetch fails', () => {
    (
      useCardChatHistoryModule.useCardChatHistory as unknown as {
        mockReturnValue: (v: unknown) => void;
      }
    ).mockReturnValue({
      messages: [],
      state: 'error',
      isLoading: false,
      isEmpty: false,
      error: 'Failed to load chat messages',
    });

    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    expect(screen.getByText('Failed to load chat messages')).toBeInTheDocument();
  });

  it('renders chat messages with correct styling', () => {
    (
      useCardChatHistoryModule.useCardChatHistory as unknown as {
        mockReturnValue: (v: unknown) => void;
      }
    ).mockReturnValue({
      messages: [
        {
          id: 'm1',
          sessionId: 'sess-1',
          role: 'user',
          content: 'Hello AI',
          authorId: 'user-1',
          authorName: 'User',
          avatar: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'm2',
          sessionId: 'sess-1',
          role: 'assistant',
          content: 'Hello! How can I help refine your requirements?',
          authorId: null,
          authorName: null,
          avatar: null,
          createdAt: new Date().toISOString(),
        },
      ],
      state: 'loaded',
      isLoading: false,
      isEmpty: false,
      error: undefined,
    });

    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    expect(screen.getByText('Hello AI')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help refine your requirements?')).toBeInTheDocument();
    // User messages show author name
    expect(screen.getByText('User')).toBeInTheDocument();
    // Assistant messages show "AI"
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('displays quality score meter', () => {
    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('displays refinement status badge', () => {
    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    expect(screen.getByText('REFINING')).toBeInTheDocument();
  });

  it('displays READY status badge when session is ready for review', () => {
    const readySession = makeSession({ status: 'READY_FOR_REVIEW', quality_score: 95 });

    render(<CardChatDrawer cardId="card-1" session={readySession} onClose={mockOnClose} />);

    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('shows paused state warning and disables composer', () => {
    const pausedSession = makeSession({ status: 'PAUSED' });

    render(<CardChatDrawer cardId="card-1" session={pausedSession} onClose={mockOnClose} />);

    expect(screen.getByText(/Session is paused/)).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Session is not active');
    expect(input.disabled).toBe(true);
  });

  it('shows ready-for-review message when session is ready', () => {
    const readySession = makeSession({ status: 'READY_FOR_REVIEW', quality_score: 95 });

    render(<CardChatDrawer cardId="card-1" session={readySession} onClose={mockOnClose} />);

    expect(screen.getByText(/Requirements are ready for review/)).toBeInTheDocument();
  });

  it('auto-pauses active session when drawer closes', () => {
    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('Close card chat');
    fireEvent.click(closeButton);

    expect(cardChatApiModule.pauseCardChatSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'card-1',
        sessionId: 'sess-1',
      })
    );
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not pause session if session is not active', () => {
    const pausedSession = makeSession({ status: 'PAUSED' });

    render(<CardChatDrawer cardId="card-1" session={pausedSession} onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(cardChatApiModule.pauseCardChatSession).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes drawer when backdrop is clicked', () => {
    const { container } = render(
      <CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />
    );

    const backdrop = container.querySelector('[aria-label="Close card chat drawer"]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('closes drawer on Escape key', async () => {
    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('sends a message and clears composer on success', async () => {
    (
      useCardChatHistoryModule.useCardChatHistory as unknown as {
        mockReturnValue: (v: unknown) => void;
      }
    ).mockReturnValue({
      messages: [],
      state: 'empty',
      isLoading: false,
      isEmpty: true,
      error: undefined,
    });

    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Describe what you want to build…');
    fireEvent.change(input, { target: { value: 'Build a login page' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(cardChatApiModule.createCardChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          sessionId: 'sess-1',
          content: 'Build a login page',
        })
      );
    });

    expect(input.value).toBe('');
  });

  it('shows send error when message creation fails', async () => {
    (
      cardChatApiModule.createCardChatMessage as unknown as {
        mockRejectedValueOnce: (e: Error) => void;
      }
    ).mockRejectedValueOnce(new Error('boom'));

    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Describe what you want to build…');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(screen.getByText('Failed to send message')).toBeInTheDocument();
    });
  });

  it('disables send when composer is empty', () => {
    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    const sendButton = screen.getByText('Send');
    expect(sendButton.disabled).toBe(true);
  });

  it('sends message on Enter key', async () => {
    (
      useCardChatHistoryModule.useCardChatHistory as unknown as {
        mockReturnValue: (v: unknown) => void;
      }
    ).mockReturnValue({
      messages: [],
      state: 'empty',
      isLoading: false,
      isEmpty: true,
      error: undefined,
    });

    render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText('Describe what you want to build…');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(cardChatApiModule.createCardChatMessage).toHaveBeenCalled();
    });
  });

  describe('Refine button', () => {
    it('shows refine button when session is ACTIVE_REFINEMENT', () => {
      render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

      expect(screen.getByText('Refine')).toBeInTheDocument();
    });

    it('hides refine button when session is PAUSED', () => {
      const pausedSession = makeSession({ status: 'PAUSED' });

      render(<CardChatDrawer cardId="card-1" session={pausedSession} onClose={mockOnClose} />);

      expect(screen.queryByText('Refine')).not.toBeInTheDocument();
    });

    it('hides refine button when session is READY_FOR_REVIEW', () => {
      const readySession = makeSession({ status: 'READY_FOR_REVIEW', quality_score: 95 });

      render(<CardChatDrawer cardId="card-1" session={readySession} onClose={mockOnClose} />);

      expect(screen.queryByText('Refine')).not.toBeInTheDocument();
    });

    it('disables refine button while refinement is in progress', async () => {
      // [why] Make the mock never resolve so we can assert the loading state
      (
        cardChatApiModule.refineCardChat as unknown as {
          mockImplementation: (fn: () => Promise<never>) => void;
        }
      ).mockImplementation(() => new Promise(() => {}));

      render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

      const refineButton = screen.getByText('Refine');
      fireEvent.click(refineButton);

      await waitFor(() => {
        expect(screen.getByText('Refining…')).toBeInTheDocument();
      });

      // Composer should be disabled during refinement
      const input = screen.getByPlaceholderText('Describe what you want to build…');
      expect(input.disabled).toBe(true);

      // Send button should be disabled during refinement
      const sendButton = screen.getByText('Send');
      expect(sendButton.disabled).toBe(true);
    });

    it('updates quality score meter after refine completes', async () => {
      render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

      // Initial score is 75 from the active session
      expect(screen.getByText('75')).toBeInTheDocument();

      const refineButton = screen.getByText('Refine');
      fireEvent.click(refineButton);

      // After refine, the mock returns quality_score 92
      await waitFor(() => {
        expect(screen.getByText('92')).toBeInTheDocument();
      });
    });

    it('updates status badge to READY after refinement completes', async () => {
      render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

      // Initially REFINING
      expect(screen.getByText('REFINING')).toBeInTheDocument();

      const refineButton = screen.getByText('Refine');
      fireEvent.click(refineButton);

      // After refine, the mock returns READY_FOR_REVIEW
      await waitFor(() => {
        expect(screen.getByText('READY')).toBeInTheDocument();
      });
    });

    it('shows refine error when refinement fails', async () => {
      (
        cardChatApiModule.refineCardChat as unknown as { mockRejectedValueOnce: (e: Error) => void }
      ).mockRejectedValueOnce(new Error('Refinement failed'));

      render(<CardChatDrawer cardId="card-1" session={activeSession} onClose={mockOnClose} />);

      const refineButton = screen.getByText('Refine');
      fireEvent.click(refineButton);

      await waitFor(() => {
        expect(screen.getByText('Refinement failed. Please try again.')).toBeInTheDocument();
      });
    });
  });
});
