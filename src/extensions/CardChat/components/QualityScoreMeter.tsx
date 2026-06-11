// QualityScoreMeter — visual 0-100 score bar for requirement refinement quality.
// Sprint 171: Placeholder UI — actual scoring data in Iteration 3 (BA Persona loop).
// Shows a colored progress bar with numeric label. Grey when no score yet.

interface Props {
  score: number | null; // 0-100, or null when not yet scored
}

const QUALITY_COLORS: Record<string, string> = {
  low: 'bg-red-400',
  medium: 'bg-amber-400',
  high: 'bg-green-400',
};

function colorForScore(score: number): string {
  if (score >= 90) return QUALITY_COLORS.high!;
  if (score >= 60) return QUALITY_COLORS.medium!;
  return QUALITY_COLORS.low!;
}

const QualityScoreMeter = ({ score }: Props) => {
  const hasScore = typeof score === 'number';
  const displayScore = hasScore ? Math.round(score) : 0;
  const barColor = hasScore ? colorForScore(displayScore) : 'bg-slate-300 dark:bg-slate-600';
  const labelColor = hasScore
    ? displayScore >= 90
      ? 'text-green-700 dark:text-green-400'
      : displayScore >= 60
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-red-700 dark:text-red-400'
    : 'text-muted';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${hasScore ? Math.min(100, Math.max(0, displayScore)) : 0}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold tabular-nums w-8 text-right ${labelColor}`}>
        {hasScore ? displayScore : '—'}
      </span>
    </div>
  );
};

export default QualityScoreMeter;
