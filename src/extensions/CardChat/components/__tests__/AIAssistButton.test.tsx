import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIAssistButton from '../AIAssistButton';

describe('AIAssistButton', () => {
  const mockOnStartChat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when feature flag is disabled', () => {
    const { container } = render(
      <AIAssistButton
        cardId="card-1"
        enabled={false}
        onStartChat={mockOnStartChat}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the AI Assist button when feature flag is enabled', () => {
    render(
      <AIAssistButton
        cardId="card-1"
        enabled={true}
        onStartChat={mockOnStartChat}
      />,
    );

    expect(screen.getByText('AI Assist')).toBeInTheDocument();
    expect(screen.getByText('AI Assist').closest('button')).not.toBeDisabled();
  });

  it('disables button when disabled prop is true', () => {
    render(
      <AIAssistButton
        cardId="card-1"
        enabled={true}
        disabled={true}
        onStartChat={mockOnStartChat}
      />,
    );

    expect(screen.getByText('AI Assist').closest('button')).toBeDisabled();
  });

  it('calls onStartChat with cardId when clicked', () => {
    render(
      <AIAssistButton
        cardId="card-42"
        enabled={true}
        onStartChat={mockOnStartChat}
      />,
    );

    fireEvent.click(screen.getByText('AI Assist'));
    expect(mockOnStartChat).toHaveBeenCalledWith('card-42');
    expect(mockOnStartChat).toHaveBeenCalledTimes(1);
  });

  it('does not call onStartChat when disabled', () => {
    render(
      <AIAssistButton
        cardId="card-1"
        enabled={true}
        disabled={true}
        onStartChat={mockOnStartChat}
      />,
    );

    fireEvent.click(screen.getByText('AI Assist'));
    expect(mockOnStartChat).not.toHaveBeenCalled();
  });
});
