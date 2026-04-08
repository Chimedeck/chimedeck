// Shared primitive components for developer documentation pages.
// Used by McpDocsPage and PluginDocsPage to ensure consistent styling.
import { ChevronRightIcon } from '@heroicons/react/24/outline';

export const Section = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-20">
    {children}
  </section>
);

export const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-4 text-xl font-semibold text-base">{children}</h2>
);

export const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2 mt-5 text-base font-semibold text-base">{children}</h3>
);

export const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3 text-sm leading-relaxed text-subtle">{children}</p>
);

export const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-bg-surface px-1.5 py-0.5 font-mono text-xs text-indigo-600 dark:text-indigo-300">
    {children}
  </code>
);

export const Pre = ({ children }: { children: React.ReactNode }) => (
  <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-bg-base px-4 py-4 font-mono text-xs leading-relaxed text-subtle">
    {children}
  </pre>
);

export const Divider = () => <hr className="my-8 border-border" />;

export const Badge = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{children}</span>
);

// Callout boxes — use these instead of inline div literals so both pages render identically.

export const InfoCallout = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={['rounded-lg border border-indigo-300 dark:border-indigo-700/40 bg-indigo-50 dark:bg-indigo-900/20 px-5 py-4', className].filter(Boolean).join(' ')}>
    <p className="text-sm text-indigo-700 dark:text-indigo-200">{children}</p>
  </div>
);

export const WarnCallout = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={['rounded-lg border border-amber-300 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200', className].filter(Boolean).join(' ')}>
    {children}
  </div>
);

export interface TableCell {
  key: string;
  content: React.ReactNode;
}

export interface TableRow {
  rowId: string;
  cells: TableCell[];
}

export const Table = ({ headers, rows }: { headers: string[]; rows: TableRow[] }) => (
  <div className="my-4 overflow-x-auto rounded-lg border border-border">
    <table className="w-full text-sm">
      <thead className="bg-bg-surface">
        <tr>
          {headers.map((h) => (
            <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.rowId} className={i % 2 === 0 ? 'bg-bg-base' : 'bg-bg-base/50'}>
            {row.cells.map((cell) => (
              <td key={cell.key} className="border-t border-border px-4 py-2 text-subtle">
                {cell.content}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const NavItem = ({ href, label }: { href: string; label: string }) => (
  <a
    href={href}
    className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-muted transition-colors hover:bg-bg-surface hover:text-base"
  >
    <ChevronRightIcon className="h-3 w-3 shrink-0 text-muted" />
    {label}
  </a>
);

// Inline code class string for use inside dangerouslySetInnerHTML HTML strings.
// Keep this in sync with the Code component above.
export const inlineCodeClass =
  'rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-indigo-600 dark:text-indigo-300';
