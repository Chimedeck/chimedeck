import React from 'react';
import * as Sentry from '@sentry/react';
import Button from '../components/Button';

interface Props {
  children: React.ReactNode;
}

function FallbackUI({ resetError }: { resetError: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-gray-500 dark:text-gray-400">
        An unexpected error occurred. Our team has been notified. You can try
        reloading the page.
      </p>
      <div className="flex gap-3">
        <Button variant="primary" size="md" onClick={resetError}>
          Try again
        </Button>
        <Button variant="secondary" size="md" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  );
}

/**
 * Top-level error boundary that catches unhandled React render errors and
 * reports them to Sentry. Falls back to a generic recovery UI.
 *
 * Wraps the full component tree so no render crash produces a blank screen.
 */
export function ErrorBoundary({ children }: Props) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => <FallbackUI resetError={resetError} />}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
