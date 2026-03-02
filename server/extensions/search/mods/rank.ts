// server/extensions/search/mods/rank.ts
// Provides ORDER BY fragment for ts_rank_cd ranking.
// Exported so query.ts can compose it into the raw SQL without duplication.

/** SQL snippet appended to the SELECT list that computes the rank score. */
export const RANK_SELECT = `ts_rank_cd(search_vector, query) AS rank`;

/** ORDER BY clause for descending rank. */
export const RANK_ORDER = `rank DESC`;
