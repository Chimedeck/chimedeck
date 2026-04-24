// BoardArchivedCardsPanel — list of all archived cards in a board with restore option.
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getArchivedCards } from './api';
import { apiClient } from '~/common/api/client';
import type { ArchivedCard } from './types';
import translations from './translations/en.json';
import Button from '~/common/components/Button';
import { contrastText } from '~/extensions/Card/components/LabelChip';

interface Props {
  boardId: string;
  /** Called after a card is successfully unarchived, so caller can refresh the board if needed. */
  onCardUnarchived?: () => void;
}

function formatArchivedAt(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

const BoardArchivedCardsPanel = ({ boardId, onCardUnarchived }: Props) => {
  const [cards, setCards] = useState<ArchivedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [, setSearchParams] = useSearchParams();

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

  const handleOpenCard = useCallback(
    (cardId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('card', cardId);
        return next;
      });
    },
    [setSearchParams],
  );

  if (error) {
    return <p className="p-4 text-sm text-danger">{error}</p>;
  }

  return (
    <div className="p-4 space-y-2">
      <h3 className="text-xs font-semibold uppercase text-muted">{translations['BoardViews.archivedCardsHeading']}</h3>

      {loading && <p className="text-sm text-subtle">{translations['BoardViews.loadingArchivedCards']}</p>}

      {!loading && cards.length === 0 && (
        <p className="text-sm italic text-subtle">{translations['BoardViews.noArchivedCards']}</p>
      )}

      {cards.map((card) => {
        const archivedAt = formatArchivedAt(card.updated_at);
        return (
          <div
            key={card.id}
            className="flex items-center justify-between rounded border border-border bg-bg-surface px-3 py-2 text-sm"
          >
            <div>
              {Array.isArray(card.labels) && card.labels.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {card.labels.map((label) => (
                    <span
                      key={label.id}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: label.color, color: contrastText(label.color) }}
                      title={label.name}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="font-medium text-link hover:underline underline-offset-2 text-left"
                onClick={() => handleOpenCard(card.id)}
              >
                {card.title}
              </button>
              <p className="text-xs text-subtle">{translations['BoardViews.inList']} {card.list_title}</p>
              {!!archivedAt && (
                <p className="text-xs text-subtle">
                  {translations['BoardViews.archivedAt']} {archivedAt}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={restoringId === card.id}
              onClick={() => handleRestore(card.id)}
              className="ml-4"
            >
              {restoringId === card.id ? translations['BoardViews.restoringButton'] : translations['BoardViews.restoreButton']}
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export default BoardArchivedCardsPanel;
