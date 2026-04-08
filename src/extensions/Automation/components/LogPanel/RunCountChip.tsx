// RunCountChip — displays the total run count for an automation.
// Grey when zero (never run), green when at least one run has occurred.
// Caps display at 999+ to avoid layout overflow.
import type { FC } from 'react';

interface Props {
  count: number;
}

const RunCountChip: FC<Props> = ({ count }) => {
  const label = count > 999 ? '999+' : String(count);
  const colourClass =
    count > 0
      ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
      : 'bg-bg-surface text-muted border-border';

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${colourClass}`}
      aria-label={`${count} run${count !== 1 ? 's' : ''}`}
      title={`${count} run${count !== 1 ? 's' : ''}`}
    >
      {label}
    </span>
  );
};

export default RunCountChip;
