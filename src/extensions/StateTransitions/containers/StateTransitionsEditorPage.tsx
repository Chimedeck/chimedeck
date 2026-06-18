import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import { useAppSelector } from '~/hooks/useAppSelector';
import {
  fetchBoardDataThunk,
  selectBoard,
  selectBoardStatus,
} from '~/extensions/Board/slices/boardSlice';
import GraphEditor from '../components/GraphEditor';
import { boardPath } from '~/common/routing/shortUrls';

const StateTransitionsEditorPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();

  const board = useAppSelector(selectBoard);
  const boardStatus = useAppSelector(selectBoardStatus);

  useEffect(() => {
    if (!boardId) return;
    dispatch(fetchBoardDataThunk({ boardId }));
  }, [boardId, dispatch]);

  if (!boardId || boardStatus === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Loading state transitions editor...
      </div>
    );
  }

  return (
    <GraphEditor
      boardId={boardId}
      boardTitle={board?.title ?? ''}
      open
      onClose={() => {
        if (board?.id) {
          navigate(
            boardPath({
              id: board.id,
              short_id: board.short_id ?? null,
              title: board.title,
            })
          );
          return;
        }
        navigate(`/b/${boardId}`);
      }}
    />
  );
};

export default StateTransitionsEditorPage;
