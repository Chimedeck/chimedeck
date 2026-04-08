// VisibilitySelector — radio group for selecting board visibility level.
export type BoardVisibility = 'PUBLIC' | 'PRIVATE' | 'WORKSPACE';

interface Option {
  value: BoardVisibility;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    value: 'PRIVATE',
    label: 'Private',
    description: 'Only workspace members can access',
  },
  {
    value: 'WORKSPACE',
    label: 'Workspace',
    description: 'All workspace members can access',
  },
  {
    value: 'PUBLIC',
    label: 'Public',
    description: 'Anyone can view without signing in',
  },
];

interface Props {
  value: BoardVisibility;
  onChange: (v: BoardVisibility) => void;
  disabled?: boolean;
}

const VisibilitySelector = ({ value, onChange, disabled = false }: Props) => {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted uppercase tracking-wide">Visibility</p>
      {OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-2 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="board-visibility"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className="mt-0.5 accent-blue-500"
          />
          <div>
            <p className="text-sm text-subtle">{opt.label}</p>
            <p className="text-xs text-muted">{opt.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
};

export default VisibilitySelector;
