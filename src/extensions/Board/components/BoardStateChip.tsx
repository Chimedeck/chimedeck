// Board state badge — shows ACTIVE or ARCHIVED visually.
import type { BoardState } from '../api';

interface Props {
  state: BoardState;
}

const BoardStateChip = ({ state }: Props) => {
  if (state === 'ARCHIVED') {
    return (
      <span className="inline-block rounded bg-bg-overlay px-2 py-0.5 text-xs font-medium text-muted">
        Archived
      </span>
    );
  }
  return (
    // [theme-exception] Active status chip uses green for positive state indication
    <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
      Active
    </span>
  );
};

export default BoardStateChip;
