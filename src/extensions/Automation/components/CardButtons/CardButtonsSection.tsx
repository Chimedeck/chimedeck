// CardButtonsSection — "Automation" section in the card modal.
// Lists all CARD_BUTTON automations for the board and lets the user trigger or manage them.
import { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import { BoltIcon } from '@heroicons/react/24/outline';
import { getAutomations, runCardButton } from '../../api';
import type { Automation } from '../../types';
import CardButtonItem, { type RunState } from './CardButtonItem';
import AddCardButtonButton from './AddCardButtonButton';
import CardButtonBuilder from './CardButtonBuilder';

interface Props {
  boardId: string;
  cardId: string;
  /** When true the card is archived — disable all run buttons */
  disabled?: boolean;
}

/** Transient per-button run state (idle/running/success/error) */
type RunStateMap = Record<string, RunState>;

const RESET_DELAY_MS = 3000;

const CardButtonsSection: FC<Props> = ({ boardId, cardId, disabled = false }) => {
  const [buttons, setButtons] = useState<Automation[]>([]);
  const [runStates, setRunStates] = useState<RunStateMap>({});
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingButton, setEditingButton] = useState<Automation | undefined>(undefined);

  const loadButtons = useCallback(async () => {
    try {
      const res = await getAutomations({ boardId });
      setButtons(res.data.filter((a) => a.automationType === 'CARD_BUTTON' && a.isEnabled));
    } catch {
      // Silently ignore — buttons are non-critical
    }
  }, [boardId]);

  useEffect(() => {
    loadButtons();
  }, [loadButtons]);

  const handleRun = async (automation: Automation) => {
    setRunStates((prev) => ({ ...prev, [automation.id]: 'running' }));
    try {
      await runCardButton({ cardId, automationId: automation.id });
      setRunStates((prev) => ({ ...prev, [automation.id]: 'success' }));
    } catch {
      setRunStates((prev) => ({ ...prev, [automation.id]: 'error' }));
    } finally {
      // Reset to idle after a short delay so the user sees the outcome.
      setTimeout(() => {
        setRunStates((prev) => ({ ...prev, [automation.id]: 'idle' }));
      }, RESET_DELAY_MS);
    }
  };

  const handleBuilderSave = (saved: Automation) => {
    setButtons((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setShowBuilder(false);
    setEditingButton(undefined);
  };

  const handleBuilderClose = () => {
    setShowBuilder(false);
    setEditingButton(undefined);
  };

  if (buttons.length === 0 && !showBuilder) {
    return (
      <section aria-label="Automation buttons">
        <div className="flex items-center gap-1.5 mb-2">
          <BoltIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <h3 className="text-sm font-medium text-slate-300">Automation</h3>
        </div>
        <AddCardButtonButton onClick={() => setShowBuilder(true)} disabled={disabled} />

        {showBuilder && (
          <CardButtonBuilder
            boardId={boardId}
            onSave={handleBuilderSave}
            onClose={handleBuilderClose}
          />
        )}
      </section>
    );
  }

  return (
    <section aria-label="Automation buttons">
      <div className="flex items-center gap-1.5 mb-2">
        <BoltIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <h3 className="text-sm font-medium text-slate-300">Automation</h3>
      </div>

      <ul className="flex flex-col gap-1.5">
        {buttons.map((btn) => (
          <li key={btn.id}>
            <CardButtonItem
              automation={btn}
              runState={runStates[btn.id] ?? 'idle'}
              onRun={() => handleRun(btn)}
              disabled={disabled}
            />
          </li>
        ))}
      </ul>

      <div className="mt-1.5">
        <AddCardButtonButton onClick={() => setShowBuilder(true)} disabled={disabled} />
      </div>

      {(showBuilder || editingButton) && (
        <CardButtonBuilder
          boardId={boardId}
          {...(editingButton ? { existing: editingButton } : {})}
          onSave={handleBuilderSave}
          onClose={handleBuilderClose}
        />
      )}
    </section>
  );
};

export default CardButtonsSection;
