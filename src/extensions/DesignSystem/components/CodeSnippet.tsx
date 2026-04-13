// CodeSnippet — displays a syntax-highlighted-ish code block.
// Clipboard copy is deferred to Iteration 12.

interface CodeSnippetProps {
  code: string;
  language?: string;
}

export default function CodeSnippet({ code, language = 'tsx' }: CodeSnippetProps) {
  return (
    <div className="rounded-md bg-bg-subtle border border-border-subtle overflow-x-auto">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle">
        <span className="text-xs text-text-secondary font-mono">{language}</span>
      </div>
      <pre className="px-4 py-3 text-sm text-text-primary font-mono whitespace-pre leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
