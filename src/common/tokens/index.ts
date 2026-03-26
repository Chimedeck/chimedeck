// Centralized semantic token class-string reference.
// CSS custom properties are defined in src/index.css.
// Tailwind color/text aliases are defined in tailwind.config.ts.
// Use these constants to keep component class strings consistent.

/** Standard text input / textarea / select element classes */
export const inputClasses =
  'w-full bg-bg-overlay text-base placeholder:text-subtle border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

/** Popover / dropdown panel container */
export const overlayPanelClasses =
  'bg-bg-surface border border-border rounded-xl shadow-xl';

/** Inline status badge — neutral */
export const neutralBadgeClasses =
  'inline-block rounded bg-bg-overlay px-2 py-0.5 text-xs font-medium text-muted';

/** Inline status badge — success */
export const successBadgeClasses =
  'inline-block rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success';

/** Inline status badge — danger */
export const dangerBadgeClasses =
  'inline-block rounded bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger';

/** Error / warning notification box (inline) */
export const errorBoxClasses =
  'bg-danger/10 border border-danger/40 rounded p-3 text-danger text-sm';

/** Hoverable list item row */
export const listItemHoverClasses =
  'w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-bg-overlay text-base transition-colors';
