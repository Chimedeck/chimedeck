import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    // Override (not extend) fontSize to remove the built-in 'base' key.
    // Reason: textColor.base ('var(--text-base)') collides with fontSize.base (1rem),
    // causing Tailwind to generate a merged hover rule that changes font-size AND color
    // when hover:text-base is used — leading to layout shift on hover.
    // 'text-base' in this project is ALWAYS used as a color utility, never a size.
    fontSize: {
      xs:   ['0.75rem',   { lineHeight: '1rem' }],
      sm:   ['0.875rem',  { lineHeight: '1.25rem' }],
      // 'base' deliberately omitted — conflicts with textColor.base token
      lg:   ['1.125rem',  { lineHeight: '1.75rem' }],
      xl:   ['1.25rem',   { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem',  { lineHeight: '2rem' }],
      '3xl': ['1.875rem',{ lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem',    { lineHeight: '1' }],
      '6xl': ['3.75rem', { lineHeight: '1' }],
      '7xl': ['4.5rem',  { lineHeight: '1' }],
      '8xl': ['6rem',    { lineHeight: '1' }],
      '9xl': ['8rem',    { lineHeight: '1' }],
    },
    extend: {
      colors: {
        /* Brand */
        primary:          'var(--color-primary)',
        'primary-hover':  'var(--color-primary-hover)',
        secondary:        'var(--color-secondary)',
        accent:           'var(--color-accent)',

        /* Surfaces */
        'bg-base':     'var(--bg-base)',
        'bg-surface':  'var(--bg-surface)',
        'bg-overlay':  'var(--bg-overlay)',
        'bg-sunken':   'var(--bg-sunken)',

        /* Borders */
        border:          'var(--border)',
        'border-strong': 'var(--border-strong)',

        /* Semantic */
        danger:   'var(--color-danger)',
        success:  'var(--color-success)',
        warning:  'var(--color-warning)',
        info:     'var(--color-info)',
      },
      textColor: {
        base:    'var(--text-base)',
        muted:   'var(--text-muted)',
        subtle:  'var(--text-subtle)',
        inverse: 'var(--text-inverse)',
        link:    'var(--text-link)',
      },
    },
  },
  plugins: [typography],
};

export default config;
