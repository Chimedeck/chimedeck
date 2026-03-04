// payToPaidConfig — configurable predicate for which list columns qualify
// for pay-to-paid payment buttons. Edit QUALIFYING_LIST_NAMES to match your
// workflow column names (case-insensitive).
const QUALIFYING_LIST_NAMES = [
  'done',
  'completed',
  'delivered',
  'ready to pay',
  'invoiced',
  'estimate',
  'test',
  'backlog',
];

/**
 * Returns true when a list (column) name qualifies for pay-to-paid payment buttons.
 * Checks if the list name contains any of the QUALIFYING_LIST_NAMES keywords (case-insensitive).
 * Used by CardItem to decide whether to render payment buttons.
 */
export function shouldShowPaymentButtons(listName: string): boolean {
  const normalized = listName.trim().toLowerCase();
  return QUALIFYING_LIST_NAMES.some(keyword => normalized.includes(keyword));
}
