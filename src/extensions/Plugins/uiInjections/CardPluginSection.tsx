// CardPluginSection — renders plugin-provided section panels in the card
// detail modal main column. Resolves the 'card-section' capability; plugins
// return { title, content } objects displayed as labelled bordered sections.
import { useState, useEffect } from 'react';
import { usePluginBridgeContext } from '../iframeHost/usePluginBridge';

interface PluginSection {
  title?: string;
  content?: string;
}

interface Props {
  cardId: string;
  listId: string;
  boardId: string;
}

const CardPluginSection = ({ cardId, listId, boardId }: Props) => {
  const bridge = usePluginBridgeContext();
  const [sections, setSections] = useState<PluginSection[]>([]);

  useEffect(() => {
    if (!bridge || !boardId) return;
    let cancelled = false;

    bridge
      .resolve('card-section', {
        card: { id: cardId },
        list: { id: listId },
        board: { id: boardId },
      })
      .then((results) => {
        if (cancelled) return;
        const all: PluginSection[] = [];
        for (const result of results) {
          if (Array.isArray(result)) all.push(...(result as PluginSection[]));
          else if (result && typeof result === 'object')
            all.push(result as PluginSection);
        }
        setSections(all.filter((s) => s.title || s.content));
      })
      .catch(() => {
        // Silent fail — plugin errors must not break the card detail modal
      });

    return () => {
      cancelled = true;
    };
  }, [bridge, boardId, cardId, listId]);

  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
        >
          {section.title && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {section.title}
            </p>
          )}
          {section.content && (
            <p className="text-sm text-slate-300 whitespace-pre-wrap">
              {section.content}
            </p>
          )}
        </div>
      ))}
    </>
  );
};

export default CardPluginSection;
