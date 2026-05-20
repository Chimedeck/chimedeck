import { useEffect, useState } from 'react';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectStateTransitionsEnabled } from '~/slices/featureFlagsSlice';
import GraphEditor from './GraphEditor';
import translations from '../translations/en.json';

interface Props {
  boardId: string;
  boardTitle: string;
}

const StateTransitionsSettingsEntry = ({ boardId, boardTitle }: Props) => {
  const stateTransitionsEnabled = useAppSelector(selectStateTransitionsEnabled);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!stateTransitionsEnabled && editorOpen) {
      setEditorOpen(false);
    }
  }, [editorOpen, stateTransitionsEnabled]);

  if (!stateTransitionsEnabled) return null;

  return (
    <>
      <section className="space-y-2">
        <div className="flex items-start gap-3 rounded border border-border bg-bg-surface p-3">
          <ArrowsRightLeftIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-base">
              {translations['StateTransitions.settingsTitle']}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {translations['StateTransitions.settingsDescription']}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditorOpen(true);
              }}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              {translations['StateTransitions.openEditorButton']}
            </button>
          </div>
        </div>
      </section>

      <GraphEditor
        boardId={boardId}
        boardTitle={boardTitle}
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
        }}
      />
    </>
  );
};

export default StateTransitionsSettingsEntry;
