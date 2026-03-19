// BoardArchivedCardsPanel — list of all archived cards in a board with restore option.
import { useEffect, useState, useCallback } from 'react';
import { getArchivedCards } from './api';
import { apiClient } from '~/common/api/client';
import type { ArchivedCard } from './types';
import translations from './translations/en.json';

interface Props {
  boardId: string;
  /** Called after a card is successfully unarchived, so caller can refresh the board if needed. */
  onCardUnarchived?: () => void;
}

const BoardArchivedCardsPanel = ({ boardId, onCardUnarchived }: Props) => {
  const [cards, setCards] = useState<ArchivedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getArchivedCards({ boardId });
      setCards(res.data);
    } catch {
      setError(translations['BoardViews.errorLoadArchivedCards']);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleRestore = async (cardId: string) => {
    setRestoringId(cardId);
    try {
      await apiClient.patch(`/cards/${cardId}/archive`, {});
      // Optimistically remove from list
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      onCardUnarchived?.();
    } catch {
      setError(translations['BoardViews.errorRestoreCard']);
    } finally {
      setRestoringId(null);
    }
  };

  if (error) {
    return <p className="p-4 text-sm text-red-500">{error}</p>;
  }

  return (
    <div className="p-4 space-y-2">
      <h3 className="text-xs font-semibold uppercase text-gray-500">{translations['BoardViews.archivedCardsHeading']}</h3>

      {loading && <p className="text-sm text-gray-400">{translations['BoardViews.loadingArchivedCards']}</p>}

      {!loading && cards.length === 0 && (
        <p className="text-sm italic text-gray-400">{translations['BoardViews.noArchivedCards']}</p>
      )}

      {cards.map((card) => (
        <div
          key={card.id}
          className="flex items-center justify-between rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
        >
          <div>
            <p className="font-medium text-gray-200">{card.title}</p>
            <p className="text-xs text-gray-500">{translations['BoardViews.inList']} {card.list_title}</p>
          </div>
          <button
            disabled={restoringId === card.id}
            onClick={() => handleRestore(card.id)}
            className="ml-4 rounded px-2 py-1 text-xs text-blue-400 hover:bg-slate-700 disabled:opacity-50"
          >
            {restoringId === card.id ? translations['BoardViews.restoringButton'] : translations['BoardViews.restoreButton']}
          </button>
        </div>
      ))}
    </div>
  );
};

export default BoardArchivedCardsPanel;
