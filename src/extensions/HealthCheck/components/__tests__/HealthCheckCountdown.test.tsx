// Render smoke tests for HealthCheckCountdown.
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HealthCheckCountdown } from '../HealthCheckCountdown';

describe('HealthCheckCountdown', () => {
  it('renders seconds remaining', () => {
    render(<HealthCheckCountdown secondsRemaining={45} />);
    expect(screen.getByText('45s')).toBeTruthy();
  });

  it('renders minutes + seconds format', () => {
    render(<HealthCheckCountdown secondsRemaining={65} />);
    expect(screen.getByText('1m 05s')).toBeTruthy();
  });

  it('renders "Refreshing…" when seconds are 0', () => {
    render(<HealthCheckCountdown secondsRemaining={0} />);
    expect(screen.getByText('Refreshing…')).toBeTruthy();
  });

  it('renders "Paused" when paused prop is true', () => {
    render(<HealthCheckCountdown secondsRemaining={30} paused={true} />);
    expect(screen.getByText('Paused')).toBeTruthy();
  });

  it('has a polite aria-live region', () => {
    const { container } = render(<HealthCheckCountdown secondsRemaining={30} />);
    const el = container.querySelector('[aria-live="polite"]');
    expect(el).toBeTruthy();
  });
});
