// PluginModal — fullscreen/standard overlay with an iframe for plugin UI.
// Opened when the plugin calls t.modal() and closed on t.closeModal() or backdrop click.
// Supports updateModal({ title, fullscreen, accentColor }) and sizeTo (auto-resize).
// When boardPlugin and boardId are provided and the plugin has whitelistedDomains,
// the PluginAllowedDomainsPanel is rendered below the iframe for board admins.

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BoardPlugin } from '../api';
import PluginAllowedDomainsPanel from '../components/PluginAllowedDomainsPanel';

export interface PluginModalState {
  open: boolean;
  url: string;
  title: string;
  fullscreen: boolean;
  accentColor?: string;
  pluginId: string;
  /** Present when modal is opened via the settings gear (board admin context). */
  boardPlugin?: BoardPlugin;
  boardId?: string;
}

interface Props {
  modal: PluginModalState;
  onClose: () => void;
}

const PluginModal = ({ modal, onClose }: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!modal.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modal.open, onClose]);

  if (!modal.open) return null;

  const headerStyle: React.CSSProperties = modal.accentColor
    ? { borderBottomColor: modal.accentColor }
    : {};

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={modal.title || 'Plugin'}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div
        className={
          modal.fullscreen
            ? 'relative w-full h-full flex flex-col bg-slate-900 shadow-2xl'
            : 'relative w-full max-w-2xl h-[80vh] flex flex-col bg-slate-900 rounded-lg shadow-2xl mx-4'
        }
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0"
          style={headerStyle}
        >
          <h2 className="text-slate-100 font-medium text-sm truncate pr-4">
            {modal.title || 'Plugin'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none flex-shrink-0"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Plugin iframe */}
        <iframe
          ref={iframeRef}
          id={`plugin-modal-iframe-${modal.pluginId}`}
          src={modal.url}
          title={modal.title || 'Plugin modal'}
          className="flex-1 w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* Allowed Domains panel — only for settings modals where boardPlugin has whitelistedDomains */}
        {modal.boardPlugin && modal.boardId && (modal.boardPlugin.plugin.whitelistedDomains?.length ?? 0) > 0 && (
          <PluginAllowedDomainsPanel
            boardPlugin={modal.boardPlugin}
            boardId={modal.boardId}
          />
        )}
      </div>
    </div>,
    document.body,
  );
};

export default PluginModal;
