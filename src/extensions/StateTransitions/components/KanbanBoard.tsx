export function getKanbanColumnBorderClass({
  isForbiddenDropTarget,
  usesDragPlaceholder,
  listHasCustomColor,
}: {
  isForbiddenDropTarget: boolean;
  usesDragPlaceholder: boolean;
  listHasCustomColor: boolean;
}): string {
  if (isForbiddenDropTarget) return 'border-red-500 ring-1 ring-red-500/40';
  if (usesDragPlaceholder) return 'border-primary';
  return listHasCustomColor ? 'border-transparent' : 'border-border';
}
