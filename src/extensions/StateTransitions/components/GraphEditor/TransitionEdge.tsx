import { useMemo, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  useViewport,
  type EdgeProps,
} from '@xyflow/react';
import translations from '../../translations/en.json';
import { DEFAULT_ACTION_TYPE_ID, getActionTypeConfig } from '../../config/actionTypes';
import type {
  StateTransitionAction,
  StateTransitionDirection,
  StateTransitionStyle,
  StateTransitionWaypoint,
} from '../../api';
import EdgeActionLabel from './EdgeActionLabel';
import EdgeDeleteButton from './EdgeDeleteButton';

interface Point {
  x: number;
  y: number;
}

export interface TransitionEdgeData {
  action: StateTransitionAction;
  direction: StateTransitionDirection;
  style: StateTransitionStyle;
  connectorOffsetX: number;
  connectorOffsetY: number;
  waypoints: StateTransitionWaypoint[];
  onInspect: (edgeId: string) => void;
  onDelete: (edgeId: string) => void;
  onPreviewOffset?: (edgeId: string, connectorOffsetX: number, connectorOffsetY: number) => void;
  onCommitOffset?: (edgeId: string, connectorOffsetX: number, connectorOffsetY: number) => void;
  onPreviewWaypoints?: (edgeId: string, waypoints: StateTransitionWaypoint[]) => void;
  onCommitWaypoints?: (edgeId: string, waypoints: StateTransitionWaypoint[]) => void;
}

const quadraticBezierPoint = ({
  t,
  p0,
  p1,
  p2,
}: {
  t: number;
  p0: { x: number; y: number };
  p1: { x: number; y: number };
  p2: { x: number; y: number };
}): { x: number; y: number } => {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
    y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
  };
};

const toPoints = (waypoints: StateTransitionWaypoint[]): Point[] =>
  waypoints.map((waypoint) => ({ x: waypoint.x, y: waypoint.y }));

const toWaypoints = (points: Point[]): StateTransitionWaypoint[] =>
  points.map((point) => ({ x: point.x, y: point.y }));

const buildOrthogonalPoints = ({
  p0,
  p2,
  connectorOffsetY,
}: {
  p0: Point;
  p2: Point;
  connectorOffsetY: number;
}): Point[] => {
  const depthY = (p0.y + p2.y) / 2 + connectorOffsetY;
  return [
    p0,
    { x: p0.x, y: depthY },
    { x: p2.x, y: depthY },
    p2,
  ];
};

const buildPolylinePath = (points: Point[]): string =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${String(point.x)} ${String(point.y)}`).join(' ');

const polylinePointAtT = (points: Point[], t: number): Point => {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const segments = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const length = Math.hypot(next.x - point.x, next.y - point.y);
    return { start: point, end: next, length };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalLength === 0) return points[0];

  let target = totalLength * t;
  for (const segment of segments) {
    if (target <= segment.length) {
      const ratio = segment.length === 0 ? 0 : target / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      };
    }
    target -= segment.length;
  }

  return points.at(-1) ?? points[0];
};

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
  const { zoom } = useViewport();
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    lastOffsetX: number;
    lastOffsetY: number;
  } | null>(null);
  const actionType = getActionTypeConfig(edgeData?.action ?? DEFAULT_ACTION_TYPE_ID);
  const actionLabel = translations[actionType.labelKey];

  const connectorOffsetX = edgeData?.connectorOffsetX ?? 0;
  const connectorOffsetY = edgeData?.connectorOffsetY ?? 0;
  const effectiveStyle: StateTransitionStyle = edgeData?.style === 'curved' ? 'smooth' : (edgeData?.style ?? 'straight');

  const p0 = useMemo(() => ({ x: sourceX, y: sourceY }), [sourceX, sourceY]);
  const p2 = useMemo(() => ({ x: targetX, y: targetY }), [targetX, targetY]);
  const p1 = useMemo(
    () => ({
      x: (sourceX + targetX) / 2 + connectorOffsetX,
      y: (sourceY + targetY) / 2 + connectorOffsetY,
    }),
    [connectorOffsetX, connectorOffsetY, sourceX, targetX, sourceY, targetY],
  );

  const orthogonalPoints = useMemo(
    () => buildOrthogonalPoints({ p0, p2, connectorOffsetY }),
    [connectorOffsetY, p0, p2],
  );

  const edgePath = useMemo(() => {
    if (effectiveStyle === 'smooth') {
      return `M ${String(p0.x)} ${String(p0.y)} Q ${String(p1.x)} ${String(p1.y)} ${String(p2.x)} ${String(p2.y)}`;
    }
    if (effectiveStyle === 'orthogonal') {
      return buildPolylinePath(orthogonalPoints);
    }
    return buildPolylinePath([p0, p1, p2]);
  }, [effectiveStyle, p0, p1, p2, orthogonalPoints]);

  const labelPoint = useMemo(() => {
    if (effectiveStyle === 'smooth') {
      return quadraticBezierPoint({ t: 0.5, p0, p1, p2 });
    }
    if (effectiveStyle === 'orthogonal') {
      return polylinePointAtT(orthogonalPoints, 0.5);
    }
    return p1;
  }, [effectiveStyle, p0, p1, p2, orthogonalPoints]);

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
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
          style={{
            pointerEvents: 'all',
            transform: `translate(-50%, -50%) translate(${String(labelPoint.x)}px,${String(labelPoint.y)}px)`,
          }}
          onMouseEnter={() => {
            setHovered(true);
          }}
          onMouseLeave={() => {
            setHovered(false);
          }}
        >
          {(edgeData?.onPreviewOffset || edgeData?.onCommitOffset) && (
            <button
              type="button"
              className="nodrag nopan h-5 w-5 cursor-grab rounded-full border-2 border-emerald-300/80 bg-emerald-400/35 hover:bg-emerald-400/50"
              aria-label="Adjust connector curve"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                dragStateRef.current = {
                  pointerId: event.pointerId,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startOffsetX: connectorOffsetX,
                  startOffsetY: connectorOffsetY,
                  lastOffsetX: connectorOffsetX,
                  lastOffsetY: connectorOffsetY,
                };
              }}
              onPointerMove={(event) => {
                if (dragStateRef.current?.pointerId !== event.pointerId) return;
                const dx = (event.clientX - dragStateRef.current.startClientX) / Math.max(zoom, 0.01);
                const dy = (event.clientY - dragStateRef.current.startClientY) / Math.max(zoom, 0.01);
                const nextOffsetX = effectiveStyle === 'orthogonal'
                  ? dragStateRef.current.startOffsetX
                  : dragStateRef.current.startOffsetX + dx;
                const nextOffsetY = dragStateRef.current.startOffsetY + dy;
                dragStateRef.current.lastOffsetX = nextOffsetX;
                dragStateRef.current.lastOffsetY = nextOffsetY;
                edgeData?.onPreviewOffset?.(id, nextOffsetX, nextOffsetY);
              }}
              onPointerUp={(event) => {
                if (dragStateRef.current?.pointerId !== event.pointerId) return;
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.releasePointerCapture(event.pointerId);
                edgeData?.onCommitOffset?.(
                  id,
                  dragStateRef.current.lastOffsetX,
                  dragStateRef.current.lastOffsetY,
                );
                dragStateRef.current = null;
              }}
              onPointerCancel={(event) => {
                if (dragStateRef.current?.pointerId !== event.pointerId) return;
                event.currentTarget.releasePointerCapture(event.pointerId);
                dragStateRef.current = null;
              }}
            />
          )}
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
