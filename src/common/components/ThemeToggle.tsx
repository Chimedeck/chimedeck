import { SunIcon, MoonIcon, SparklesIcon, BookOpenIcon, StarIcon, ArchiveBoxIcon, ChevronDownIcon, ComputerDesktopIcon, CubeTransparentIcon, Square2StackIcon, SwatchIcon, GlobeAltIcon, BoltIcon } from '@heroicons/react/24/outline';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../hooks/useTheme';

const THEME_ORDER: Theme[] = ['light', 'dark', 'elegant', 'elegant-dark', 'paper', 'nordic', 'archive', 'macintosh', 'obsidian', 'next', 'bauhaus', 'moss', 'vapor', 'cyberpunk', 'the-seven', 'hc-light', 'hc-dark'];

const THEME_META: Record<Theme, { icon: React.ReactNode; label: string }> = {
  light:          { icon: <SunIcon className="w-4 h-4" />,                label: 'Light' },
  dark:           { icon: <MoonIcon className="w-4 h-4" />,               label: 'Dark' },
  elegant:        { icon: <SparklesIcon className="w-4 h-4" />,           label: 'Elegant' },
  'elegant-dark': { icon: <MoonIcon className="w-4 h-4" />,               label: 'Elegant Dark' },
  paper:          { icon: <BookOpenIcon className="w-4 h-4" />,           label: 'Paper' },
  nordic:         { icon: <StarIcon className="w-4 h-4" />,               label: 'Nordic' },
  archive:        { icon: <ArchiveBoxIcon className="w-4 h-4" />,         label: 'Archive' },
  macintosh:      { icon: <ComputerDesktopIcon className="w-4 h-4" />,    label: 'Macintosh' },
  obsidian:       { icon: <CubeTransparentIcon className="w-4 h-4" />,    label: 'Obsidian' },
  next:           { icon: <Square2StackIcon className="w-4 h-4" />,       label: 'NeXT' },
  bauhaus:        { icon: <SwatchIcon className="w-4 h-4" />,             label: 'Bauhaus' },
  moss:           { icon: <GlobeAltIcon className="w-4 h-4" />,             label: 'Moss' },
  vapor:          { icon: <BoltIcon className="w-4 h-4" />,               label: 'Vapor' },
  cyberpunk:      { icon: <BoltIcon className="w-4 h-4" />,               label: 'Night City' },
  'the-seven':    { icon: <StarIcon className="w-4 h-4" />,               label: 'The Seven' },
  'hc-light':     { icon: <SunIcon className="w-4 h-4" />,                label: 'HC Light' },
  'hc-dark':      { icon: <MoonIcon className="w-4 h-4" />,               label: 'HC Dark' },
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = THEME_META[theme]!;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-muted hover:text-base hover:bg-bg-overlay transition-colors text-xs font-medium"
      >
        {current.icon}
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Select theme"
          className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-bg-surface shadow-lg py-1 z-50"
        >
          {THEME_ORDER.map((t) => {
            const meta = THEME_META[t]!;
            const active = t === theme;
            return (
              <button
                key={t}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setTheme(t); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors
                  ${active
                    ? 'text-base bg-bg-overlay font-medium'
                    : 'text-muted hover:text-base hover:bg-bg-overlay'
                  }`}
              >
                {meta.icon}
                {meta.label}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
