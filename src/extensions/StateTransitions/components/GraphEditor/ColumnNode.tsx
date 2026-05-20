import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import type { GraphEditorNode } from './useGraphEditor';

const handleBaseClass = 'h-2.5 w-2.5 rounded-full border border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800';

const ColumnNode = ({ data }: NodeProps<GraphEditorNode>) => {
  return (
    <div className="relative min-h-20 min-w-[200px] max-w-[220px] rounded-lg border border-neutral-300 bg-white px-3 py-3 shadow-sm dark:border-neutral-600 dark:bg-neutral-800">
      <Handle id="top-source" type="source" position={Position.Top} className={handleBaseClass} style={{ top: -5, left: '45%' }} />
      <Handle id="top-target" type="target" position={Position.Top} className={handleBaseClass} style={{ top: -5, left: '55%' }} />
      <Handle id="right-source" type="source" position={Position.Right} className={handleBaseClass} style={{ right: -5, top: '45%' }} />
      <Handle id="right-target" type="target" position={Position.Right} className={handleBaseClass} style={{ right: -5, top: '55%' }} />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className={handleBaseClass} style={{ bottom: -5, left: '45%' }} />
      <Handle id="bottom-target" type="target" position={Position.Bottom} className={handleBaseClass} style={{ bottom: -5, left: '55%' }} />
      <Handle id="left-source" type="source" position={Position.Left} className={handleBaseClass} style={{ left: -5, top: '45%' }} />
      <Handle id="left-target" type="target" position={Position.Left} className={handleBaseClass} style={{ left: -5, top: '55%' }} />

      <div className="flex items-center gap-2">
        <Squares2X2Icon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
        <span className="truncate text-sm font-semibold text-base" title={data.label}>
          {data.label}
        </span>
      </div>
    </div>
  );
};

export default ColumnNode;
