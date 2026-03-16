// ResizablePanels — two-column drag-to-resize layout.
// Persists column ratio to localStorage under key `card_modal_column_ratio`.
// On mobile (< 768px) collapses to vertical stack with no drag handle.
import React, { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'card_modal_column_ratio';
const DEFAULT_RATIO = 0.55;
const MIN_WIDTH_PX = 280;
const MOBILE_BREAKPOINT = 768;

function loadRatio(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed > 0 && parsed < 1) return parsed;
    }
  } catch {
    // localStorage unavailable (e.g. SSR / private browsing)
  }
  return DEFAULT_RATIO;
}

function saveRatio(ratio: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(ratio));
  } catch {
    // ignore
  }
}

interface ResizablePanelsProps {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}

export default function ResizablePanels({ left, right, className = '' }: ResizablePanelsProps) {
  const [ratio, setRatio] = useState<number>(loadRatio);
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Update mobile breakpoint on resize
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const clampRatio = useCallback((rawRatio: number, containerWidth: number): number => {
    const minRatio = MIN_WIDTH_PX / containerWidth;
    const maxRatio = 1 - minRatio;
    return Math.min(maxRatio, Math.max(minRatio, rawRatio));
  }, []);

  const handleMove = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const { left: containerLeft, width } = container.getBoundingClientRect();
      const newRatio = clampRatio((clientX - containerLeft) / width, width);
      setRatio(newRatio);
    },
    [clampRatio],
  );

  // Mouse events
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (dragging.current) handleMove(ev.clientX);
      };
      const onMouseUp = (ev: MouseEvent) => {
        dragging.current = false;
        handleMove(ev.clientX);
        // Persist only on mouse-up
        const container = containerRef.current;
        if (container) {
          const { left: containerLeft, width } = container.getBoundingClientRect();
          saveRatio(clampRatio((ev.clientX - containerLeft) / width, width));
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [handleMove, clampRatio],
  );

  // Touch events
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragging.current = true;
      const touch = e.touches[0];
      if (touch) handleMove(touch.clientX);

      const onTouchMove = (ev: TouchEvent) => {
        if (dragging.current && ev.touches[0]) handleMove(ev.touches[0].clientX);
      };
      const onTouchEnd = (ev: TouchEvent) => {
        dragging.current = false;
        const lastTouch = ev.changedTouches[0];
        if (lastTouch) {
          const container = containerRef.current;
          if (container) {
            const { left: containerLeft, width } = container.getBoundingClientRect();
            saveRatio(clampRatio((lastTouch.clientX - containerLeft) / width, width));
          }
        }
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
      };

      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
    },
    [handleMove, clampRatio],
  );

  if (isMobile) {
    return (
      <div className={`flex flex-col ${className}`}>
        <div className="w-full">{left}</div>
        <div className="w-full">{right}</div>
      </div>
    );
  }

  const leftPercent = `${(ratio * 100).toFixed(2)}%`;
  const rightPercent = `${((1 - ratio) * 100).toFixed(2)}%`;

  return (
    <div ref={containerRef} className={`flex overflow-hidden ${className}`}>
      {/* Left panel */}
      <div style={{ width: leftPercent, minWidth: MIN_WIDTH_PX }} className="overflow-y-auto">
        {left}
      </div>

      {/* Drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        className="relative flex-shrink-0 w-1 cursor-col-resize bg-transparent hover:bg-indigo-400 active:bg-indigo-500 transition-colors group"
        tabIndex={0}
        // Keyboard support: arrow keys adjust ratio by 1%
        onKeyDown={(e) => {
          const step = 0.01;
          if (e.key === 'ArrowLeft') {
            const next = clampRatio(ratio - step, containerRef.current?.offsetWidth ?? 800);
            setRatio(next);
            saveRatio(next);
          } else if (e.key === 'ArrowRight') {
            const next = clampRatio(ratio + step, containerRef.current?.offsetWidth ?? 800);
            setRatio(next);
            saveRatio(next);
          }
        }}
      >
        {/* Visual grab indicator */}
        <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-indigo-400/20" />
      </div>

      {/* Right panel */}
      <div style={{ width: rightPercent, minWidth: MIN_WIDTH_PX }} className="overflow-y-auto">
        {right}
      </div>
    </div>
  );
}
