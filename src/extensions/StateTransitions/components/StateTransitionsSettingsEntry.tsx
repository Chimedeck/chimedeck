import { useNavigate } from 'react-router-dom';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectStateTransitionsEnabled } from '~/slices/featureFlagsSlice';
import translations from '../translations/en.json';
import { stateTransitionsEditorPath } from '~/common/routing/shortUrls';

interface Props {
  boardId: string;
  boardTitle: string;
  canOpenEditor?: boolean;
}

const StateTransitionsSettingsEntry = ({ boardId, boardTitle, canOpenEditor = true }: Props) => {
  const navigate = useNavigate();
  const stateTransitionsEnabled = useAppSelector(selectStateTransitionsEnabled);

  if (!stateTransitionsEnabled) return null;

  return (
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
          {canOpenEditor ? (
            <button
              type="button"
              onClick={() => {
                navigate(stateTransitionsEditorPath({ id: boardId, title: boardTitle }));
              }}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              {translations['StateTransitions.openEditorButton']}
            </button>
          ) : (
            <p className="mt-2 text-xs text-muted">View-only for guests</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default StateTransitionsSettingsEntry;
