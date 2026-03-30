import React from 'react';
import * as Sentry from '@sentry/react';

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
        <button
          onClick={resetError}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          Reload page
        </button>
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
