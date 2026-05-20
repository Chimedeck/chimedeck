import { useEffect, useMemo, useState } from 'react';
import Button from '~/common/components/Button';
import { apiClient } from '~/common/api/client';
import { listBoards, type Board } from '~/extensions/Board/api';
import { listWorkspaces, type Workspace } from '~/extensions/Workspace/api';
import { useAppSelector } from '~/hooks/useAppSelector';
import { selectCurrentUser } from '~/slices/authSlice';
import translations from '../translations/en.json';

interface Props {
  open: boolean;
  sourceBoardId: string;
  currentWorkspaceId: string | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (args: { targetBoard: Board; copyEnabled: boolean }) => Promise<void>;
}

const ADMIN_ROLES = new Set(['ADMIN', 'OWNER']);

const CopyTransitionsModal = ({
  open,
  sourceBoardId,
  currentWorkspaceId,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) => {
  const currentUser = useAppSelector(selectCurrentUser);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [targetBoardId, setTargetBoardId] = useState('');
  const [copyEnabled, setCopyEnabled] = useState(true);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCopyEnabled(true);
    setLoadError(null);
    setLoadingWorkspaces(true);
    void listWorkspaces({ api: apiClient })
      .then(({ data }) => {
        setWorkspaces(data);
        const defaultWorkspaceId = (
          currentWorkspaceId && data.some((workspace) => workspace.id === currentWorkspaceId)
            ? currentWorkspaceId
            : data[0]?.id
        ) ?? '';
        setWorkspaceId(defaultWorkspaceId);
      })
      .catch(() => {
        setLoadError(translations['StateTransitions.copyModalLoadWorkspacesFailed']);
        setWorkspaces([]);
        setWorkspaceId('');
      })
      .finally(() => {
        setLoadingWorkspaces(false);
      });
  }, [currentWorkspaceId, open]);

  useEffect(() => {
    if (!open || workspaceId.trim().length === 0) {
      setBoards([]);
      setTargetBoardId('');
      return;
    }

    setLoadingBoards(true);
    setLoadError(null);
    void listBoards({ api: apiClient, workspaceId })
      .then(async ({ data }) => {
        const candidateBoards = data.filter(
          (board) => board.id !== sourceBoardId && board.state === 'ACTIVE',
        );
        if (candidateBoards.length === 0 || !currentUser?.id) {
          setBoards([]);
          setTargetBoardId('');
          return;
        }

        const roles = await Promise.all(
          candidateBoards.map(async (board) => {
            try {
              const response = await apiClient.get<{ data: Array<{ user_id: string; role: string }> }>(
                `/boards/${board.id}/members`,
              );
              const me = response.data.data.find((member) => member.user_id === currentUser.id);
              return ADMIN_ROLES.has(me?.role ?? '') ? board.id : null;
            } catch {
              return null;
            }
          }),
        );
        const allowedIds = new Set(roles.filter((id): id is string => Boolean(id)));
        const filteredBoards = candidateBoards.filter((board) => allowedIds.has(board.id));
        setBoards(filteredBoards);
        setTargetBoardId(filteredBoards[0]?.id ?? '');
      })
      .catch(() => {
        setLoadError(translations['StateTransitions.copyModalLoadBoardsFailed']);
        setBoards([]);
        setTargetBoardId('');
      })
      .finally(() => {
        setLoadingBoards(false);
      });
  }, [currentUser?.id, open, sourceBoardId, workspaceId]);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === targetBoardId) ?? null,
    [boards, targetBoardId],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-base">{translations['StateTransitions.copyModalTitle']}</h2>
        <p className="mt-1 text-sm text-muted">{translations['StateTransitions.copyModalDescription']}</p>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedBoard || busy) return;
            void onConfirm({ targetBoard: selectedBoard, copyEnabled });
          }}
        >
          <div>
            <label htmlFor="copy-transitions-workspace" className="mb-1 block text-xs font-medium text-muted">
              {translations['StateTransitions.copyModalWorkspaceLabel']}
            </label>
            <select
              id="copy-transitions-workspace"
              value={workspaceId}
              onChange={(event) => {
                setWorkspaceId(event.target.value);
              }}
              disabled={busy || loadingWorkspaces}
              className="w-full rounded border border-border bg-bg-base px-3 py-2 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="copy-transitions-board" className="mb-1 block text-xs font-medium text-muted">
              {translations['StateTransitions.copyModalBoardLabel']}
            </label>
            <select
              id="copy-transitions-board"
              value={targetBoardId}
              onChange={(event) => {
                setTargetBoardId(event.target.value);
              }}
              disabled={busy || loadingBoards || boards.length === 0}
              className="w-full rounded border border-border bg-bg-base px-3 py-2 text-sm text-base focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {boards.length === 0 && (
                <option value="">
                  {translations['StateTransitions.copyModalNoBoards']}
                </option>
              )}
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.title}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {translations['StateTransitions.copyModalWarning']}
          </div>

          <label className="flex items-center gap-2 text-sm text-base">
            <input
              type="checkbox"
              checked={copyEnabled}
              onChange={(event) => {
                setCopyEnabled(event.target.checked);
              }}
              disabled={busy}
              className="rounded border-border"
            />
            {translations['StateTransitions.copyModalCopyEnabledLabel']}
          </label>

          {(loadError || error) && (
            <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {loadError ?? error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="md" onClick={onCancel} disabled={busy}>
              {translations['StateTransitions.cancelButton']}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={busy || selectedBoard === null || loadingBoards || loadingWorkspaces}
            >
              {busy ? translations['StateTransitions.copyModalCopying'] : translations['StateTransitions.copyModalConfirmButton']}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CopyTransitionsModal;
