// PluginIframeHost — renders a single hidden <iframe> for one plugin.
// The src URL is the plugin's connectorUrl enriched with context query params
// so the plugin can call jhInstance.initialize() and start communicating.

import type { BoardPlugin } from '../api';
import { useRef } from 'react';

interface Props {
  boardPlugin: BoardPlugin;
  boardId: string;
}

const PluginIframeHost = ({ boardPlugin, boardId }: Props) => {
  const { plugin } = boardPlugin;
  const cacheBustRef = useRef<string>(`${Date.now()}`);

  // Build the iframe src with required context params
  let src: string;
  try {
    const url = new URL(plugin.connectorUrl);
    url.searchParams.set('boardId', boardId);
    url.searchParams.set('pluginId', plugin.id);
    // Pass the host origin so the plugin can validate back-messages
    url.searchParams.set('origin', globalThis.location.origin);
    url.searchParams.set('cb', cacheBustRef.current);
    src = url.toString();
  } catch {
    // Malformed connectorUrl — skip rendering
    return null;
  }

  return (
    <iframe
      id={`plugin-iframe-${plugin.id}`}
      src={src}
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
