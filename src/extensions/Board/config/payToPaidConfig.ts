// payToPaidConfig — configurable predicate for which list columns qualify
// for pay-to-paid payment buttons. Edit QUALIFYING_LIST_NAMES to match your
// workflow column names (case-insensitive).
const QUALIFYING_LIST_NAMES = ['done', 'completed', 'delivered', 'ready to pay', 'invoiced'];

/**
 * Returns true when a list (column) name qualifies for pay-to-paid payment buttons.
 * Used by CardItem to decide whether to render payment buttons.
 */
export function shouldShowPaymentButtons(listName: string): boolean {
  return QUALIFYING_LIST_NAMES.includes(listName.trim().toLowerCase());
}
