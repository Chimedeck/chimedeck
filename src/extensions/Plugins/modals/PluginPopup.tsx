// PluginPopup — small floating popup with an iframe for plugin UI.
// Opened when the plugin calls t.popup() and closed on t.closePopup() or click-outside.
// Positioned near the triggering element via mouseEvent coordinates.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import translations from '../translations/en.json';

export interface PluginPopupState {
  open: boolean;
  url: string;
  title: string;
  pluginId: string;
  x: number;
  y: number;
  args?: Record<string, unknown>;
}

interface Props {
  popup: PluginPopupState;
  onClose: () => void;
}

const POPUP_WIDTH = 300;
const POPUP_MAX_HEIGHT = 400;

const PluginPopup = ({ popup, onClose }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key or click outside
  useEffect(() => {
    if (!popup.open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    // Use capture so we catch clicks even inside iframes (won't fire from cross-origin, that's fine)
    window.addEventListener('mousedown', handleClick, true);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick, true);
    };
  }, [popup.open, onClose]);

  if (!popup.open) return null;

  // Clamp position so popup stays within viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(popup.x, vw - POPUP_WIDTH - 8);
  const top = Math.min(popup.y, vh - POPUP_MAX_HEIGHT - 8);

  // Build iframe src with passed args as query params
  let iframeSrc = popup.url;
  if (popup.args && Object.keys(popup.args).length > 0) {
    try {
      const u = new URL(popup.url, window.location.origin);
      for (const [k, v] of Object.entries(popup.args)) {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      }
      iframeSrc = u.toString();
    } catch {
      // fallback: use original url
    }
  }

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-50 bg-bg-surface border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
      style={{ left, top, width: POPUP_WIDTH, maxHeight: POPUP_MAX_HEIGHT }}
      role="dialog"
      aria-modal="true"
      aria-label={popup.title || translations['plugins.popup.defaultTitle']}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-base text-xs font-medium truncate pr-3">
          {popup.title || translations['plugins.popup.defaultTitle']}
        </span>
        <button
          onClick={onClose}
          className="text-muted hover:text-subtle text-sm leading-none flex-shrink-0"
          aria-label={translations['plugins.popup.closeAriaLabel']}
        >
          ✕
        </button>
      </div>

      {/* Plugin iframe */}
      <iframe
        id={`plugin-popup-iframe-${popup.pluginId}`}
        src={iframeSrc}
        title={popup.title || translations['plugins.popup.defaultTitle']}
        className="flex-1 w-full border-0 bg-white"
        style={{ minHeight: 120 }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>,
    document.body,
  );
};

export default PluginPopup;
