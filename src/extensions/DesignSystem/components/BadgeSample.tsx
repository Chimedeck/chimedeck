// BadgeSample — renders a set of badge/pill variants used across the app.
// Badges are inline spans styled with semantic tokens; no dedicated Badge
// component exists yet so these are the canonical class patterns.

interface BadgeVariant {
  label: string;
  className: string;
}

const BADGE_VARIANTS: BadgeVariant[] = [
  {
    label: 'Default',
    className:
      'bg-bg-overlay text-muted border border-border',
  },
  {
    label: 'Primary',
    className:
      'bg-primary text-white', // [theme-exception] white text on primary bg
  },
  {
    label: 'Success',
    className:
      'bg-success text-white', // [theme-exception] white text on success bg
  },
  {
    label: 'Danger',
    className:
      'bg-danger text-white', // [theme-exception] white text on danger bg
  },
  {
    label: 'Warning',
    className:
      'bg-warning text-black', // [theme-exception] black text on warning bg
  },
  {
    label: 'Info',
    className:
      'bg-info text-white', // [theme-exception] white text on info bg
  },
];

/** Base classes shared by all badge variants. */
const BASE =
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold';

export default function BadgeSample() {
  return (
    <div className="flex flex-wrap gap-3">
      {BADGE_VARIANTS.map(({ label, className }) => (
        <span key={label} className={`${BASE} ${className}`}>
          {label}
        </span>
      ))}
    </div>
  );
}
