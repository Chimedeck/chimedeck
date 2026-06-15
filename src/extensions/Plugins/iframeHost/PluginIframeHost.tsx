// PluginIframeHost — renders a single hidden <iframe> for one plugin.
// The src URL is the plugin's connectorUrl enriched with context query params
// so the plugin can call jhInstance.initialize() and start communicating.
//
// WHY: src is built once via useMemo with empty deps. React only updates the
// iframe.src DOM attribute when the prop value changes — by memoizing to a
// stable reference, React never touches src after the initial mount, preventing
// browser iframe reloads that would re-execute the SDK and trigger initialize()
// multiple times.

import type { BoardPlugin } from '../api';
import { useMemo } from 'react';

interface Props {
  boardPlugin: BoardPlugin;
  boardId: string;
}

const PluginIframeHost = ({ boardPlugin, boardId }: Props) => {
  const { plugin } = boardPlugin;

  // Build src once — stable reference so React never updates the DOM attribute
  const src = useMemo(() => {
    try {
      const url = new URL(plugin.connectorUrl);
      url.searchParams.set('boardId', boardId);
      url.searchParams.set('pluginId', plugin.id);
      url.searchParams.set('origin', globalThis.location.origin);
      url.searchParams.set('cb', String(Date.now()));
      return url.toString();
    } catch {
      return null;
    }
  }, []);

  if (src === null) {
    // Malformed connectorUrl — skip rendering
    return null;
  }

  return (
    <iframe
      src={src}
      id={`plugin-iframe-${plugin.id}`}
      title={`Plugin: ${plugin.name}`}
      // Hidden — this iframe is a headless messaging bridge only.
      // Visible UI (popups / modals) is rendered separately via PluginModal / PluginPopup.
      style={{ display: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      // Prevent the plugin from navigating the top-level page
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
};

export default PluginIframeHost;
