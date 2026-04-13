// TooltipExample — CSS-only tooltip pattern using group/peer hover.
// Advanced focus-trap tooltip (Radix/Floating UI) is deferred to Iteration 12.

interface TooltipWrapProps {
  tip: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'right';
}

function Tooltip({ tip, children, position = 'top' }: TooltipWrapProps) {
  const posClass =
    position === 'bottom'
      ? 'top-full mt-1.5 left-1/2 -translate-x-1/2'
      : position === 'right'
        ? 'left-full ml-1.5 top-1/2 -translate-y-1/2'
        : 'bottom-full mb-1.5 left-1/2 -translate-x-1/2';

  return (
    <div className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className={[
          'absolute z-10 whitespace-nowrap rounded px-2 py-1',
          'bg-gray-900 text-white text-xs font-medium shadow',
          'opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150',
          posClass,
        ].join(' ')}
      >
        {tip}
      </span>
    </div>
  );
}

export default function TooltipExample() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
          Position variants — hover to reveal
        </p>
        <div className="flex flex-wrap items-center gap-8">
          <Tooltip tip="Tooltip on top" position="top">
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-border text-sm text-text-primary hover:bg-bg-subtle"
            >
              Top
            </button>
          </Tooltip>

          <Tooltip tip="Tooltip below" position="bottom">
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-border text-sm text-text-primary hover:bg-bg-subtle"
            >
              Bottom
            </button>
          </Tooltip>

          <Tooltip tip="Tooltip to the right" position="right">
            <button
              type="button"
              className="px-3 py-1.5 rounded border border-border text-sm text-text-primary hover:bg-bg-subtle"
            >
              Right
            </button>
          </Tooltip>
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        This demo uses a pure CSS group-hover pattern. A Floating UI / Radix tooltip with proper focus handling will be wired in Iteration 12.
      </p>
    </div>
  );
}
