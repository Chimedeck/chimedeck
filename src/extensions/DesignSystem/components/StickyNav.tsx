// StickyNav — sidebar navigation for the design-system page.
// Uses IntersectionObserver to highlight the currently-visible section.
import { useEffect, useState } from 'react';

interface NavItem {
  id: string;
  label: string;
}

interface StickyNavProps {
  items: readonly NavItem[];
}

export default function StickyNav({ items }: StickyNavProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observers: IntersectionObserver[] = [];

    // Track which sections are currently intersecting; use the topmost one as active.
    const intersecting = new Set<string>();

    const pick = () => {
      // Walk the nav order and pick the first intersecting id
      for (const { id } of items) {
        if (intersecting.has(id)) {
          setActiveId(id);
          return;
        }
      }
    };

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const obs = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting) {
            intersecting.add(id);
          } else {
            intersecting.delete(id);
          }
          pick();
        },
        // Trigger when the top portion of the section enters the viewport
        { rootMargin: '-10% 0px -80% 0px', threshold: 0 },
      );

      obs.observe(el);
      observers.push(obs);
    });

    return () => { observers.forEach((obs) => { obs.disconnect(); }); };
  }, [items]);

  return (
    <nav
      aria-label="Design system sections"
      className="hidden lg:flex flex-col sticky top-0 self-start w-52 shrink-0 py-8 pl-6 pr-4 h-screen overflow-y-auto border-r border-border-subtle"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
        Contents
      </p>
      <ul className="space-y-1" role="list">
        {items.map(({ id, label }) => {
          const isActive = id === activeId;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? 'location' : undefined}
                className={[
                  'block text-sm py-0.5 transition-colors rounded px-1',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                  isActive
                    ? 'text-text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary',
                ].join(' ')}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
