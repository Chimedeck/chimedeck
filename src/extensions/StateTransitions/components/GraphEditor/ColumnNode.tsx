import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import type { GraphEditorNode } from './useGraphEditor';
import PhaseChip from '../PhaseChip';

const sourceHandleClass =
  'h-4 w-4 rounded-full border-2 border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800';
const targetHandleClass = 'h-4 w-4 rounded-full border-0 bg-transparent opacity-0';

const ColumnNode = ({ data }: NodeProps<GraphEditorNode>) => {
  return (
    <div className="relative min-h-20 min-w-[200px] max-w-[220px] rounded-lg border border-neutral-300 bg-white px-3 py-3 shadow-sm dark:border-neutral-600 dark:bg-neutral-800">
      <Handle
        id="top-left-source"
        type="source"
        position={Position.Top}
        className={sourceHandleClass}
        style={{ top: -8, left: '35%' }}
      />
      <Handle
        id="top-left-target"
        type="target"
        position={Position.Top}
        className={targetHandleClass}
        style={{ top: -8, left: '35%' }}
      />
      <Handle
        id="top-right-source"
        type="source"
        position={Position.Top}
        className={sourceHandleClass}
        style={{ top: -8, left: '65%' }}
      />
      <Handle
        id="top-right-target"
        type="target"
        position={Position.Top}
        className={targetHandleClass}
        style={{ top: -8, left: '65%' }}
      />

      <Handle
        id="right-top-source"
        type="source"
        position={Position.Right}
        className={sourceHandleClass}
        style={{ right: -8, top: '35%' }}
      />
      <Handle
        id="right-top-target"
        type="target"
        position={Position.Right}
        className={targetHandleClass}
        style={{ right: -8, top: '35%' }}
      />
      <Handle
        id="right-bottom-source"
        type="source"
        position={Position.Right}
        className={sourceHandleClass}
        style={{ right: -8, top: '65%' }}
      />
      <Handle
        id="right-bottom-target"
        type="target"
        position={Position.Right}
        className={targetHandleClass}
        style={{ right: -8, top: '65%' }}
      />

      <Handle
        id="bottom-left-source"
        type="source"
        position={Position.Bottom}
        className={sourceHandleClass}
        style={{ bottom: -8, left: '35%' }}
      />
      <Handle
        id="bottom-left-target"
        type="target"
        position={Position.Bottom}
        className={targetHandleClass}
        style={{ bottom: -8, left: '35%' }}
      />
      <Handle
        id="bottom-right-source"
        type="source"
        position={Position.Bottom}
        className={sourceHandleClass}
        style={{ bottom: -8, left: '65%' }}
      />
      <Handle
        id="bottom-right-target"
        type="target"
        position={Position.Bottom}
        className={targetHandleClass}
        style={{ bottom: -8, left: '65%' }}
      />

      <Handle
        id="left-top-source"
        type="source"
        position={Position.Left}
        className={sourceHandleClass}
        style={{ left: -8, top: '35%' }}
      />
      <Handle
        id="left-top-target"
        type="target"
        position={Position.Left}
        className={targetHandleClass}
        style={{ left: -8, top: '35%' }}
      />
      <Handle
        id="left-bottom-source"
        type="source"
        position={Position.Left}
        className={sourceHandleClass}
        style={{ left: -8, top: '65%' }}
      />
      <Handle
        id="left-bottom-target"
        type="target"
        position={Position.Left}
        className={targetHandleClass}
        style={{ left: -8, top: '65%' }}
      />

      <div className="flex items-center gap-2">
        <Squares2X2Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span className="truncate text-sm font-semibold text-base" title={data.label}>
          {data.label}
        </span>
      </div>
      {/** Sprint 172 — render workflow phase chips if configured on this column */}
      {data.workflowPhases !== undefined &&
        Array.isArray(data.workflowPhases) &&
        data.workflowPhases.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {data.workflowPhases.map((phase) => (
              <PhaseChip key={phase} phase={phase} />
            ))}
          </div>
        )}
    </div>
  );
};

export default ColumnNode;
