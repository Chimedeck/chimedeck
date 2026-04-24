export function getAdjustedPointerY({
  pointerY,
  verticalScrollDelta,
}: {
  pointerY: number | null;
  verticalScrollDelta: number;
}): number | null {
  if (pointerY == null || !Number.isFinite(pointerY)) return null;
  if (!Number.isFinite(verticalScrollDelta) || verticalScrollDelta === 0) return pointerY;
  return pointerY + verticalScrollDelta;
}

export function shouldRecomputeFromPointerDestination({
  disableLiveDragPreview,
  pointerListId,
  pointerListExists,
  fromListId,
  resolvedToListId,
  resolvedFromPlaceholder,
}: {
  disableLiveDragPreview: boolean;
  pointerListId: string | null;
  pointerListExists: boolean;
  fromListId: string;
  resolvedToListId: string;
  resolvedFromPlaceholder: boolean;
}): boolean {
  return (
    disableLiveDragPreview
    && pointerListId != null
    && pointerListExists
    && pointerListId !== fromListId
    && (!resolvedFromPlaceholder || pointerListId !== resolvedToListId)
  );
}
