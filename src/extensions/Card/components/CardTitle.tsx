// CardTitle — click-to-edit card title (h1), saves on blur or Enter.
import { useState, useRef, useEffect } from 'react';

interface Props {
  title: string;
  onSave: (title: string) => void;
  disabled?: boolean;
}

const CardTitle = ({ title, onSave, disabled }: Props) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external title changes when not editing
  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(title);
    } else if (trimmed !== title) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="text-xl font-bold text-base bg-bg-overlay focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1 w-full"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(title); setEditing(false); }
        }}
        aria-label="Card title"
        maxLength={512}
        autoFocus
      />
    );
  }

  return (
    <h1
      className={`text-xl font-bold text-gray-900 rounded px-2 py-1 w-full cursor-text hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors${
        disabled ? ' cursor-default pointer-events-none' : ''
      }`}
      onClick={() => !disabled && setEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true); }}
      role={disabled ? undefined : 'button'}
      tabIndex={disabled ? undefined : 0}
      aria-label="Edit card title"
    >
      {title}
    </h1>
  );
};

export default CardTitle;
