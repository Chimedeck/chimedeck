// BoardPage — renders a single board with lists and cards (shallow, lists/cards added in sprint 06/07).
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Page from '~/components/Page';
import TopbarContainer from '~/containers/TopbarContainer/TopbarContainer';
import FooterContainer from '~/containers/FooterContainer/FooterContainer';
import LayoutSingleColumn from '~/layout/LayoutSingleColumn';
import { useAppSelector } from '~/hooks/useAppSelector';
import { useAppDispatch } from '~/hooks/useAppDispatch';
import BoardStateChip from '../../components/BoardStateChip';
import {
  boardSelector,
  fetchBoardInProgressSelector,
  fetchBoardErrorSelector,
  fetchBoardThunk,
} from './BoardPage.duck';

const BoardPage = () => {
  const dispatch = useAppDispatch();
  const { boardId } = useParams<{ boardId: string }>();

  const board = useAppSelector(boardSelector);
  const loading = useAppSelector(fetchBoardInProgressSelector);
  const error = useAppSelector(fetchBoardErrorSelector);

  useEffect(() => {
    if (boardId) dispatch(fetchBoardThunk({ boardId }));
  }, [dispatch, boardId]);

  const pageContent = (() => {
    if (loading) return <p className="text-gray-500">Loading board…</p>;
    if (error) return <p className="text-red-600">Failed to load board.</p>;
    if (!board) return null;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{board.title}</h1>
          <BoardStateChip state={board.state} />
        </div>
        {board.state === 'ARCHIVED' && (
          <p className="rounded border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
            This board is archived and read-only.
          </p>
        )}
        {/* Lists and cards will be rendered here from sprint 06/07 */}
        <p className="text-gray-400 text-sm">Lists and cards coming in sprint 06.</p>
      </div>
    );
  })();

  return (
    <Page title={board?.title ?? 'Board'}>
      <LayoutSingleColumn
        topbar={<TopbarContainer />}
        footer={<FooterContainer />}
      >
        <div className="mx-auto max-w-full px-4 py-6">{pageContent}</div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default BoardPage;
