// ChecklistProgress — shows completed/total count and a progress bar.
interface Props {
  total: number;
  checked: number;
}

export const ChecklistProgress = ({ total, checked }: Props) => {
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100);

  return (
    <div className="flex items-center gap-2" aria-label={`Checklist progress: ${checked} of ${total}`}>
      <span className="min-w-[2.5rem] text-right text-xs text-gray-500">{pct}%</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{checked}/{total}</span>
    </div>
  );
};
