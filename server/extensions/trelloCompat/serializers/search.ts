import type { TrelloMember, TrelloSearchResponse } from '../types/trello';

type SearchPayload = Partial<TrelloSearchResponse>;

export function serializeSearchResponse(payload: SearchPayload = {}): TrelloSearchResponse {
  return {
    boards: [...(payload.boards ?? [])],
    cards: [...(payload.cards ?? [])],
    members: [...(payload.members ?? [])],
    organizations: [...(payload.organizations ?? [])],
  };
}

export function serializeSearchMembers(payload: TrelloMember[] = []): TrelloMember[] {
  return [...payload];
}
