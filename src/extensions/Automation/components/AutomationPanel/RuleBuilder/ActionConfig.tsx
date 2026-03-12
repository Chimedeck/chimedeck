// ActionConfig — renders dynamic config form fields for a selected action type.
// Mirrors TriggerConfig but namespaced per-action so keys don't clash.
import { useEffect, useState } from 'react';
import type { ActionType } from '../../../types';
import { renderConfigField, parseConfigSchema } from './configFieldRenderer';
import { apiClient } from '~/common/api/client';

interface Props {
  actionType: ActionType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  boardId: string;
}

const ActionConfig = ({ actionType, config, onChange, boardId }: Props) => {
  const [boardLists, setBoardLists] = useState<{ id: string; title: string }[]>([]);
  const [workspaceBoards, setWorkspaceBoards] = useState<{ id: string; title: string }[]>([]);
  const [targetBoardLists, setTargetBoardLists] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    apiClient
      .get(`/boards/${boardId}/lists`)
      .then((res: any) => setBoardLists(res.data ?? []))
      .catch(() => {});
  }, [boardId]);

  // Fetch the other boards in the same workspace — needed for board-select fields.
  useEffect(() => {
    apiClient
      .get(`/boards/${boardId}/workspace/boards`)
      .then((res: any) => setWorkspaceBoards(res.data ?? []))
      .catch(() => {});
  }, [boardId]);

  // Whenever the user picks a target board, fetch its lists for the target-list-select field.
  const selectedTargetBoardId = typeof config.targetBoardId === 'string' ? config.targetBoardId : null;
  useEffect(() => {
    if (!selectedTargetBoardId) {
      setTargetBoardLists([]);
      return;
    }
    apiClient
      .get(`/boards/${selectedTargetBoardId}/lists`)
      .then((res: any) => setTargetBoardLists(res.data ?? []))
      .catch(() => setTargetBoardLists([]));
  }, [selectedTargetBoardId]);

  const fields = parseConfigSchema(actionType.configSchema);

  if (fields.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2">
      {fields.map(({ key, fieldDef }) =>
        renderConfigField({
          key,
          fieldDef,
          value: config[key],
          onChange: (val) => {
            const next = { ...config, [key]: val };
            // Clear the target list when the target board changes so stale data isn't saved.
            if (key === 'targetBoardId') {
              next.targetListId = undefined;
            }
            onChange(next);
          },
          boardLists,
          workspaceBoards,
          targetBoardLists,
        })
      )}
    </div>
  );
};

export default ActionConfig;
