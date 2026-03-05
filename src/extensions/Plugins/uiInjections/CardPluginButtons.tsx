// CardPluginButtons — renders plugin-provided action buttons on card tiles.
// Resolves the 'card-buttons' capability via the plugin bridge. Clicking a
// button sends BUTTON_CLICKED to all active plugins that can handle it;
// the plugin responds with UI_POPUP / UI_MODAL (handled in iteration 10).
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '~/hooks/useAppSelector';
import { usePluginBridgeContext } from '../iframeHost/usePluginBridge';
import { selectBoardPlugins } from '../containers/PluginDashboardPage/PluginDashboardPage.duck';

interface PluginButton {
  text: string;
  icon?: string;
  condition?: string;
}

interface Props {
  cardId: string;
  listId: string;
}

const CardPluginButtons = ({ cardId, listId }: Props) => {
  const { boardId } = useParams<{ boardId: string }>();
  const bridge = usePluginBridgeContext();
  const boardPlugins = useAppSelector(selectBoardPlugins);
  const [buttons, setButtons] = useState<PluginButton[]>([]);

  useEffect(() => {
    if (!bridge || !boardId) return;
    let cancelled = false;

    bridge
      .resolve('card-buttons', {
        card: { id: cardId },
        list: { id: listId },
        board: { id: boardId },
      })
      .then((results) => {
        if (cancelled) return;
        const all: PluginButton[] = [];
        for (const result of results) {
          if (Array.isArray(result)) all.push(...(result as PluginButton[]));
          else if (result && typeof result === 'object')
            all.push(result as PluginButton);
        }
        setButtons(all);
      })
      .catch(() => {
        // Silent fail — plugin errors must not break the card tile
      });

    return () => {
      cancelled = true;
    };
  }, [bridge, boardId, cardId, listId]);

  const handleButtonClick = useCallback(
    (button: PluginButton, e: React.MouseEvent) => {
      // WHY: stop propagation so clicking a plugin button doesn't also open the card modal
      e.stopPropagation();
      if (!bridge) return;

      // Broadcast BUTTON_CLICKED to all active plugins — each plugin handles its own
      for (const bp of boardPlugins) {
        bridge.sendToPlugin(bp.plugin.id, {
          jhSdk: true,
          id: `btn-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'BUTTON_CLICKED',
          payload: {
            capability: 'card-buttons',
            buttonText: button.text,
            context: {
              card: { id: cardId },
              list: { id: listId },
              board: { id: boardId },
            },
          },
        });
      }
    },
    [bridge, boardPlugins, cardId, listId, boardId],
  );

  if (buttons.length === 0) return null;

  return (
    // WHY: stopPropagation on the wrapper prevents card-click when clicking
    // on any part of the buttons row that isn't a button itself
    <div className="mt-1.5 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
      {buttons.map((btn, i) => (
        <button
          key={i}
          onClick={(e) => handleButtonClick(btn, e)}
          className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-600 transition-colors"
        >
          {btn.icon && (
            <img src={btn.icon} alt="" className="h-3 w-3 object-contain" />
          )}
          {btn.text}
        </button>
      ))}
    </div>
  );
};

export default CardPluginButtons;
