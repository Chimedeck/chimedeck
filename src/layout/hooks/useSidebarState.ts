// useSidebarState — persists desktop sidebar collapsed/expanded state across reloads.
import { useState } from 'react';

const STORAGE_KEY = 'sidebar_collapsed';

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors (e.g., private browsing quota)
      }
      return next;
    });
  };

  return { collapsed, toggle };
}
