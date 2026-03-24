// Render smoke tests for HealthCheckRow.
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HealthCheckRow } from '../HealthCheckRow';
import type { HealthCheck } from '../../api';

const baseEntry: HealthCheck = {
  id: 'hc-1',
  boardId: 'board-1',
  name: 'Stripe API',
  url: 'https://api.stripe.com/',
  type: 'preset',
  presetKey: 'stripe',
  isActive: true,
  createdAt: new Date().toISOString(),
  latestResult: null,
};

describe('HealthCheckRow', () => {
  it('renders service name and URL', () => {
    render(<HealthCheckRow entry={baseEntry} isProbing={false} onRemove={vi.fn()} />);
    expect(screen.getByText('Stripe API')).toBeTruthy();
    expect(screen.getByText('https://api.stripe.com/')).toBeTruthy();
  });

  it('shows spinner when probing', () => {
    render(<HealthCheckRow entry={baseEntry} isProbing={true} onRemove={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders response time when result exists', () => {
    const entry: HealthCheck = {
      ...baseEntry,
      latestResult: {
        status: 'green',
        httpStatus: 200,
        responseTimeMs: 120,
        errorMessage: null,
        checkedAt: new Date().toISOString(),
      },
    };
    render(<HealthCheckRow entry={entry} isProbing={false} onRemove={vi.fn()} />);
    expect(screen.getByText('120 ms')).toBeTruthy();
  });

  it('renders "Timeout" for red timed-out result', () => {
    const entry: HealthCheck = {
      ...baseEntry,
      latestResult: {
        status: 'red',
        httpStatus: null,
        responseTimeMs: null,
        errorMessage: 'timeout after 10s',
        checkedAt: new Date().toISOString(),
      },
    };
    render(<HealthCheckRow entry={entry} isProbing={false} onRemove={vi.fn()} />);
    expect(screen.getByText('Timeout')).toBeTruthy();
  });
});
