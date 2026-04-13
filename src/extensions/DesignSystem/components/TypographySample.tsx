// TypographySample — renders a text specimen alongside its token metadata.

interface TypographySampleProps {
  /** Label shown in the meta column, e.g. "Heading 1" */
  label: string;
  /** Tailwind size/weight classes applied to the sample text */
  className: string;
  /** Specimen text rendered at this style */
  sample?: string;
}

export default function TypographySample({
  label,
  className,
  sample = 'The quick brown fox jumps over the lazy dog',
}: TypographySampleProps) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-border-subtle last:border-b-0">
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
      <p className={`text-text-primary ${className}`}>{sample}</p>
    </div>
  );
}
