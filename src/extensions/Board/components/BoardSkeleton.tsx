// BoardSkeleton — shimmer placeholder for lists + cards shown while the board is loading.
import CardSkeleton from './CardSkeleton';

const LIST_COUNT = 3;
const CARD_COUNT = 4;

const ListSkeleton = () => (
  <div className="flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-bg-surface p-3">
    <div className="mb-2 h-5 w-1/2 rounded bg-bg-overlay animate-pulse" />
    {Array.from({ length: CARD_COUNT }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

const BoardSkeleton = () => {
  return (
    <div className="flex gap-4 overflow-x-auto p-4">
      {Array.from({ length: LIST_COUNT }).map((_, i) => (
        <ListSkeleton key={i} />
      ))}
    </div>
  );
};

export default BoardSkeleton;
