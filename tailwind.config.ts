import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
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
