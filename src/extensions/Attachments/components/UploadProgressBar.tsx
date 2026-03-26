// UploadProgressBar — animated progress bar for in-flight file uploads.
// Accepts a 0–100 progress value; shows an indeterminate stripe when progress
// is unavailable (null/undefined).
import React from 'react';
import translations from '../translations/en.json';

interface Props {
  /** 0–100. Pass null/undefined for indeterminate (striped animation). */
  progress: number | null | undefined;
  /** Optional accessible label override */
  label?: string;
}

export function UploadProgressBar({ progress, label = translations['attachments.progressBar.label'] }: Props): React.ReactElement {
  const isIndeterminate = progress == null;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={isIndeterminate ? undefined : progress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="w-full h-1.5 bg-bg-overlay rounded overflow-hidden"
    >
      {isIndeterminate ? (
        // Indeterminate stripe animation via Tailwind animate-pulse substitute
        <div className="h-full w-1/3 bg-blue-400 rounded animate-[shimmer_1.2s_ease-in-out_infinite]" />
      ) : (
        <div
          className="h-full bg-blue-500 rounded transition-all duration-200"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      )}
    </div>
  );
}
