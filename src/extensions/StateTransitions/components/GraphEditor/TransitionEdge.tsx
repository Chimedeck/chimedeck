import { useMemo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';
import translations from '../../translations/en.json';
import { DEFAULT_ACTION_TYPE_ID, getActionTypeConfig } from '../../config/actionTypes';
import type { StateTransitionAction, StateTransitionDirection, StateTransitionStyle } from '../../api';
import EdgeActionLabel from './EdgeActionLabel';
import EdgeDeleteButton from './EdgeDeleteButton';

export interface TransitionEdgeData {
  action: StateTransitionAction;
  direction: StateTransitionDirection;
  style: StateTransitionStyle;
  onInspect: (edgeId: string) => void;
  onDelete: (edgeId: string) => void;
}

const TransitionEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  markerStart,
  selected,
  style,
  data,
}: EdgeProps) => {
  const [hovered, setHovered] = useState(false);
  const edgeData = data as TransitionEdgeData | undefined;
  const isSelected = Boolean(selected);
  const actionType = getActionTypeConfig(edgeData?.action ?? DEFAULT_ACTION_TYPE_ID);
  const actionLabel = translations[actionType.labelKey];

  const [edgePath, labelX, labelY] = useMemo(
    () => (edgeData?.style === 'curved'
      ? getBezierPath({ sourceX, sourceY, targetX, targetY })
      : getStraightPath({ sourceX, sourceY, targetX, targetY })),
    [edgeData?.style, sourceX, sourceY, targetX, targetY],
  );

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: actionType.colour,
          strokeWidth: isSelected ? 2.5 : 2,
        }}
        {...(markerEnd ? { markerEnd } : {})}
        {...(markerStart ? { markerStart } : {})}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-all absolute flex items-center gap-1"
          style={{
            transform: `translate(-50%, -50%) translate(${String(labelX)}px,${String(labelY)}px)`,
          }}
          onMouseEnter={() => {
            setHovered(true);
          }}
          onMouseLeave={() => {
            setHovered(false);
          }}
        >
          <EdgeActionLabel
            label={actionLabel}
            active={isSelected}
            onClick={() => {
              edgeData?.onInspect(id);
            }}
          />
          {(hovered || isSelected) && edgeData && (
            <EdgeDeleteButton onClick={() => {
              edgeData.onDelete(id);
            }}
            />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default TransitionEdge;
