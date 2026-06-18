import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import Button from '~/common/components/Button';
import translations from '../../translations/en.json';

interface Props {
  open: boolean;
  busy: boolean;
  listTitles: string[];
  error: string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const NodeDeleteConfirmationModal = ({
  open,
  busy,
  listTitles,
  error,
  onConfirm,
  onCancel,
}: Props) => {
  if (!open) return null;

  const joinedTitles = listTitles.join(', ');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-border bg-bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <ExclamationTriangleIcon
            className="mt-0.5 h-6 w-6 shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-lg font-semibold text-base">
              {translations['StateTransitions.deleteColumnModalTitle']}
            </h2>
            <p className="mt-2 text-sm text-base">
              {translations['StateTransitions.deleteColumnModalBody'].replace(
                '{listTitles}',
                joinedTitles
              )}
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            {translations['StateTransitions.cancelButton']}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            disabled={busy}
            onClick={() => {
              void onConfirm();
            }}
          >
            {busy
              ? translations['StateTransitions.deleting']
              : translations['StateTransitions.deleteColumnButton']}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NodeDeleteConfirmationModal;
