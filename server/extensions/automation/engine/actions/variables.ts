// Variable substitution for automation action text fields.
// Supported variables: {cardName}, {boardName}, {listName}, {date}, {dueDate}, {triggerMember}
// Unrecognised variables are left as-is.

import type { Knex } from 'knex';

export interface VariableContext {
  cardId: string;
  boardId: string;
  actorId: string | null;
  trx: Knex.Transaction;
}

interface ResolvedVars {
  cardName: string;
  boardName: string;
  listName: string;
  date: string;
  dueDate: string;
  triggerMember: string;
}

async function resolveVars(ctx: VariableContext): Promise<ResolvedVars> {
  const card = await ctx.trx('cards').where({ id: ctx.cardId }).first();
  const list = card ? await ctx.trx('lists').where({ id: card.list_id }).first() : null;
  const board = await ctx.trx('boards').where({ id: ctx.boardId }).first();

  let triggerMember = '';
  if (ctx.actorId) {
    const user = await ctx.trx('users').where({ id: ctx.actorId }).first();
    triggerMember = user?.display_name ?? user?.full_name ?? '';
  }

  return {
    cardName: card?.title ?? '',
    boardName: board?.name ?? '',
    listName: list?.name ?? '',
    date: new Date().toISOString().slice(0, 10),
    dueDate: card?.due_date ? new Date(card.due_date).toISOString().slice(0, 10) : '',
    triggerMember,
  };
}

/**
 * Substitutes {variable} placeholders in text.
 * Unknown variables are preserved unchanged.
 */
export async function substituteVariables(text: string, ctx: VariableContext): Promise<string> {
  const knownVarNames: (keyof ResolvedVars)[] = [
    'cardName',
    'boardName',
    'listName',
    'date',
    'dueDate',
    'triggerMember',
  ];

  // Only resolve vars if the text contains any known variable patterns
  const hasVar = knownVarNames.some((v) => text.includes(`{${v}}`));
  if (!hasVar) return text;

  const vars = await resolveVars(ctx);

  return text.replace(/\{([^}]+)\}/g, (match, key: string) => {
    if (key in vars) return vars[key as keyof ResolvedVars];
    return match; // leave unknown variables intact
  });
}
