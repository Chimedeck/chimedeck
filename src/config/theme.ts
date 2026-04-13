// Central design token reference for React components.
// CSS custom properties live in src/index.css.
// Tailwind aliases live in tailwind.config.ts.
// Button class strings are defined here so components stay free of ad-hoc styling.

export const buttonVariants = {
  // ── Solid variants ──────────────────────────────────────
  primary:
    'bg-primary text-white hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed', // [theme-exception] text-white on primary-colored button
  secondary:
    'bg-bg-overlay text-base border border-border hover:bg-bg-sunken focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-muted hover:bg-bg-overlay hover:text-base focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-danger text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed', // [theme-exception] text-white on danger-colored button
  success:
    'bg-success text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed', // [theme-exception] text-white on success-colored button
  // Looks and behaves like an inline anchor but stays a <button> for semantic/a11y correctness.
  link:
    'bg-transparent text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',

  // ── Sizes ────────────────────────────────────────────────
  lg:   'px-6 py-3 text-base font-semibold rounded-lg',
  md:   'px-4 py-2 text-sm font-medium rounded-md',
  sm:   'px-3 py-1.5 text-xs font-medium rounded',
  icon: 'p-2 rounded-md',
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'link';
export type ButtonSize    = 'lg' | 'md' | 'sm' | 'icon';
