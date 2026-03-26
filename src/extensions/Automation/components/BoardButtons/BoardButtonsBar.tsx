// BoardButtonsBar — horizontal strip of board-level automation buttons shown in the board header.
// Renders up to 5 buttons; shows an overflow indicator when more exist.
// Placed immediately to the left of AutomationHeaderButton.
import { useState, useCallback, useEffect } from 'react';
import type { FC } from 'react';
import { getAutomations, runBoardButton } from '../../api';
import type { Automation } from '../../types';
import BoardButtonItem, { type RunState } from './BoardButtonItem';
import translations from '../../translations/en.json';

interface Props {
  boardId: string;
}

const MAX_VISIBLE = 5;
type RunStateMap = Record<string, RunState>;
const RESET_DELAY_MS = 3000;

const BoardButtonsBar: FC<Props> = ({ boardId }) => {
  const [buttons, setButtons] = useState<Automation[]>([]);
  const [runStates, setRunStates] = useState<RunStateMap>({});

  const loadButtons = useCallback(async () => {
    try {
      const res = await getAutomations({ boardId });
      setButtons(res.data.filter((a) => a.automationType === 'BOARD_BUTTON' && a.isEnabled));
    } catch {
      // Non-critical — fail silently
    }
  }, [boardId]);

  useEffect(() => {
    loadButtons();
  }, [loadButtons]);

  const handleRun = async (automation: Automation) => {
    setRunStates((prev) => ({ ...prev, [automation.id]: 'running' }));
    try {
      await runBoardButton({ boardId, automationId: automation.id });
      setRunStates((prev) => ({ ...prev, [automation.id]: 'success' }));
    } catch {
      setRunStates((prev) => ({ ...prev, [automation.id]: 'error' }));
    } finally {
      setTimeout(() => {
        setRunStates((prev) => ({ ...prev, [automation.id]: 'idle' }));
      }, RESET_DELAY_MS);
    }
  };

  if (buttons.length === 0) return null;

  const visible = buttons.slice(0, MAX_VISIBLE);
  const overflowCount = buttons.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-0.5" aria-label={translations['automation.boardButtonsBar.ariaLabel']}>
      {visible.map((btn) => (
        <BoardButtonItem
          key={btn.id}
          automation={btn}
          runState={runStates[btn.id] ?? 'idle'}
          onRun={() => handleRun(btn)}
        />
      ))}
      {overflowCount > 0 && (
        <div
          className="flex items-center justify-center rounded px-1.5 py-1 text-xs text-muted"
          title={`${overflowCount} more board button${overflowCount !== 1 ? 's' : ''}`}
          aria-label={`${overflowCount} more board buttons`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
};

export default BoardButtonsBar;
