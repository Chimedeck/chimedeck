import type { TrelloReaction, TrelloReactionSummary } from '../types/trello';

type MemberRef = {
  id: string;
};

function stableReactionId(row: {
  id?: string | null;
  idModel: string;
  idMember: string;
  emoji: string;
}): string {
  return row.id ?? `${row.idModel}:${row.idMember}:${row.emoji}`;
}

export function serializeReaction(row: {
  id?: string | null;
  idMember: string;
  idModel: string;
  emoji: string;
  member?: MemberRef;
}): TrelloReaction {
  return {
    id: stableReactionId(row),
    idMember: row.idMember,
    idModel: row.idModel,
    emoji: row.emoji,
    ...(row.member ? { member: row.member } : {}),
  };
}

export function serializeReactionsSummary(input: {
  idModel: string;
  reactions: TrelloReaction[];
}): TrelloReactionSummary {
  const summary: TrelloReactionSummary = {};
  for (const reaction of input.reactions) {
    const key = reaction.emoji;
    const bucket = summary[key];
    if (bucket) {
      bucket.count += 1;
      bucket.idMembers.push(reaction.idMember);
      continue;
    }
    summary[key] = {
      emoji: reaction.emoji,
      idModel: input.idModel,
      count: 1,
      idMembers: [reaction.idMember],
    };
  }
  return summary;
}
