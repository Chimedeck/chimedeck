// ColorSwatch — visualises a single design-token colour with its name and
// CSS variable for quick reference in the design system page.

interface ColorSwatchProps {
  /** CSS variable name, e.g. "--color-brand-primary" */
  variable: string;
  /** Human-readable label shown below the swatch */
  label: string;
  /** Tailwind / inline background class or hex — resolved from the CSS var at runtime */
  bgClass?: string;
}

export default function ColorSwatch({ variable, label, bgClass }: ColorSwatchProps) {
  return (
    <div className="flex flex-col items-start gap-2 w-32">
      <div
        className={`w-full h-16 rounded-md border border-border-subtle shadow-sm ${bgClass ?? ''}`}
        style={bgClass ? undefined : { background: `var(${variable})` }}
        aria-label={label}
      />
      <div>
        <p className="text-xs font-medium text-text-primary leading-tight">{label}</p>
        <p className="text-xs text-text-secondary font-mono leading-tight">{variable}</p>
      </div>
    </div>
  );
}
