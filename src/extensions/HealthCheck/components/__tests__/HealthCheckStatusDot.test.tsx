// Render smoke tests for HealthCheckStatusDot.
// Verifies the component renders without throwing for all status values.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HealthCheckStatusDot } from '../HealthCheckStatusDot';

describe('HealthCheckStatusDot', () => {
  it('renders with no status (unknown/gray)', () => {
    const { container } = render(<HealthCheckStatusDot status={null} />);
    expect(container.querySelector('[role="img"]')).toBeTruthy();
  });

  it('renders green status', () => {
    render(<HealthCheckStatusDot status="green" httpStatus={200} responseTimeMs={120} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '200 OK · 120 ms');
  });

  it('renders amber status with slow label', () => {
    render(<HealthCheckStatusDot status="amber" httpStatus={200} responseTimeMs={1340} />);
    const el = screen.getByRole('img');
    expect(el.getAttribute('aria-label')).toContain('slow');
  });

  it('renders red status with timeout', () => {
    render(<HealthCheckStatusDot status="red" errorMessage="timeout after 10s" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Request timed out');
  });

  it('renders unknown tooltip when never probed', () => {
    render(<HealthCheckStatusDot status="unknown" />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Not yet checked — click ↻ to probe',
    );
  });
});
