import { useEffect, useRef, useState } from 'react';
import Button from '~/common/components/Button';
import translations from '../../translations/en.json';

interface Props {
  open: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (title: string) => Promise<void>;
}

const AddColumnModal = ({
  open,
  busy,
  error,
  onCancel,
  onCreate,
}: Props) => {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [open]);

  if (!open) return null;

  const trimmed = title.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-surface p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-base">{translations['StateTransitions.addColumnModalTitle']}</h2>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed.length === 0 || busy) return;
            void onCreate(trimmed);
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={title}
            placeholder={translations['StateTransitions.addColumnModalPlaceholder']}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className="w-full rounded border border-border bg-bg-base px-3 py-2 text-sm text-base placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {error && (
            <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={busy}>
              {translations['StateTransitions.cancelButton']}
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={trimmed.length === 0 || busy}>
              {busy ? translations['StateTransitions.creating'] : translations['StateTransitions.createButton']}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddColumnModal;
