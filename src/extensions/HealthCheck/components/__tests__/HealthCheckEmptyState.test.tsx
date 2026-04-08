// Render smoke tests for HealthCheckEmptyState.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HealthCheckEmptyState } from '../HealthCheckEmptyState';

describe('HealthCheckEmptyState', () => {
  it('renders empty state message', () => {
    render(<HealthCheckEmptyState onAddService={vi.fn()} />);
    expect(screen.getByText('No services monitored yet')).toBeTruthy();
  });

  it('calls onAddService when button is clicked', () => {
    const onAdd = vi.fn();
    render(<HealthCheckEmptyState onAddService={onAdd} />);
    screen.getByText('Add your first service').click();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
