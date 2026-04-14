import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'elegant' | 'elegant-dark' | 'paper' | 'nordic' | 'archive' | 'macintosh' | 'obsidian' | 'next' | 'bauhaus' | 'moss' | 'vapor' | 'cyberpunk' | 'the-seven' | 'hc-light' | 'hc-dark';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'elegant', 'elegant-dark', 'paper', 'nordic', 'archive', 'macintosh', 'obsidian', 'next', 'bauhaus', 'moss', 'vapor', 'cyberpunk', 'the-seven', 'hc-light', 'hc-dark'];
const ALL_THEME_CLASSES = ['dark', 'elegant', 'elegant-dark', 'theme-paper', 'theme-nordic', 'theme-archive', 'theme-macintosh', 'theme-obsidian', 'theme-next', 'theme-bauhaus', 'theme-moss', 'theme-vapor', 'theme-cyberpunk', 'theme-the-seven', 'theme-hc-light', 'theme-hc-dark'];

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  // Remove all theme classes first
  html.classList.remove(...ALL_THEME_CLASSES);
  if (theme === 'dark') {
    html.classList.add('dark');
  } else if (theme === 'elegant') {
    html.classList.add('elegant');
  } else if (theme === 'elegant-dark') {
    // Add both so Tailwind `dark:` variants still fire for components that use them
    html.classList.add('dark', 'elegant-dark');
  } else if (theme === 'paper') {
    html.classList.add('theme-paper');
  } else if (theme === 'nordic') {
    // Dark background — add `dark` so Tailwind dark: variants fire
    html.classList.add('dark', 'theme-nordic');
  } else if (theme === 'archive') {
    html.classList.add('theme-archive');
  } else if (theme === 'macintosh') {
    html.classList.add('theme-macintosh');
  } else if (theme === 'obsidian') {
    // Dark background — add `dark` so Tailwind dark: variants fire
    html.classList.add('dark', 'theme-obsidian');
  } else if (theme === 'next') {
    html.classList.add('theme-next');
  } else if (theme === 'bauhaus') {
    html.classList.add('theme-bauhaus');
  } else if (theme === 'moss') {
    html.classList.add('theme-moss');
  } else if (theme === 'vapor') {
    // Dark background — add `dark` so Tailwind dark: variants fire
    html.classList.add('dark', 'theme-vapor');
  } else if (theme === 'cyberpunk') {
    html.classList.add('dark', 'theme-cyberpunk');
  } else if (theme === 'the-seven') {
    html.classList.add('dark', 'theme-the-seven');
  } else if (theme === 'hc-light') {
    html.classList.add('theme-hc-light');
  } else if (theme === 'hc-dark') {
    html.classList.add('dark', 'theme-hc-dark');
  }
  // 'light' = no extra class (bare :root)
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; cycle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    return THEME_CYCLE.includes(saved as Theme) ? (saved as Theme) : 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const cycle = () => {
    setTheme((current) => {
      const idx = THEME_CYCLE.indexOf(current);
      return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]!;
    });
  };

  return { theme, setTheme, cycle };
}
