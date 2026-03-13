// CardSkeleton — shimmer placeholder shown while a card is loading.
const CardSkeleton = () => {
  return (
    <div className="animate-pulse rounded-lg border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
      <div className="mb-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-slate-600" />
      <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-slate-600" />
    </div>
  );
};

export default CardSkeleton;
