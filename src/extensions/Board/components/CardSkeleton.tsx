// CardSkeleton — shimmer placeholder shown while a card is loading.
const CardSkeleton = () => {
  return (
    <div className="animate-pulse rounded-lg border border-border bg-bg-surface p-3 shadow-sm">
      <div className="mb-2 h-4 w-3/4 rounded bg-bg-overlay" />
      <div className="h-3 w-1/2 rounded bg-bg-overlay" />
    </div>
  );
};

export default CardSkeleton;
