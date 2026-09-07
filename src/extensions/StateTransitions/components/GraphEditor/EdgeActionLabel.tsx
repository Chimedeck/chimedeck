interface Props {
  label: string;
  active: boolean;
  onClick: () => void;
}

const EdgeActionLabel = ({ label, active, onClick }: Props) => (
  <button
    type="button"
    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
      active
        ? 'border-border-strong bg-bg-overlay text-base'
        : 'border-border bg-bg-surface/95 text-muted hover:bg-bg-overlay hover:text-base'
    }`}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    }}
  >
    {label}
  </button>
);

export default EdgeActionLabel;
