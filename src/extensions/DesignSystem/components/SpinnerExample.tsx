// SpinnerExample — showcases Spinner sizes and usage.
import Spinner from '~/common/components/Spinner';

export default function SpinnerExample() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Sizes</p>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="sm" />
            <span className="text-xs text-text-secondary">sm</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" />
            <span className="text-xs text-text-secondary">md</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="lg" />
            <span className="text-xs text-text-secondary">lg</span>
          </div>
        </div>
      </div>
    </div>
  );
}
