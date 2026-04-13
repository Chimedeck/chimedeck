// CodeSnippet — displays a syntax-highlighted-ish code block with copy-to-clipboard.
import { useState, useCallback } from 'react';
import { ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';

interface CodeSnippetProps {
  code: string;
  language?: string;
}

export default function CodeSnippet({ code, language = 'tsx' }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    }).catch(() => {
      // clipboard unavailable (e.g. HTTP context) — silently ignore
    });
  }, [code]);

  return (
    <div className="rounded-md bg-bg-subtle border border-border-subtle overflow-x-auto">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle">
        <span className="text-xs text-text-secondary font-mono">{language}</span>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary
                     transition-colors rounded px-1.5 py-0.5 hover:bg-bg-surface focus-visible:outline
                     focus-visible:outline-2 focus-visible:outline-primary"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          ) : (
            <ClipboardIcon className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>

        {/* Announced to screen readers when copy succeeds */}
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? 'Code copied to clipboard' : ''}
        </span>
      </div>
      <pre className="px-4 py-3 text-sm text-text-primary font-mono whitespace-pre leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
