type HasId = {
  id: string;
  short_id?: string | null;
  title?: string | null;
};

function toSlug(title?: string | null): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function getBoardRouteId(board: HasId): string {
  return board.short_id ?? board.id;
}

export function getCardRouteId(card: HasId): string {
  return card.short_id ?? card.id;
}

export function boardPath(board: HasId): string {
  const slug = toSlug(board.title);
  return slug ? `/b/${getBoardRouteId(board)}/${slug}` : `/b/${getBoardRouteId(board)}`;
}

export function cardPath(card: HasId): string {
  const slug = toSlug(card.title);
  return slug ? `/c/${getCardRouteId(card)}/${slug}` : `/c/${getCardRouteId(card)}`;
}
