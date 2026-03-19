// Trigger registry index — imports and registers all trigger handlers.
// Import this module once at server startup to populate the TRIGGER_REGISTRY.

import { registerTrigger } from '../registry';

import { cardCreatedTrigger } from './card/created';
import { cardMovedToListTrigger } from './card/movedToList';
import { cardMovedFromListTrigger } from './card/movedFromList';
import { cardLabelAddedTrigger } from './card/labelAdded';
import { cardLabelRemovedTrigger } from './card/labelRemoved';
import { cardMemberAddedTrigger } from './card/memberAdded';
import { cardMemberRemovedTrigger } from './card/memberRemoved';
import { cardDueDateSetTrigger } from './card/dueDateSet';
import { cardDueDateRemovedTrigger } from './card/dueDateRemoved';
import { cardChecklistCompletedTrigger } from './card/checklistCompleted';
import { cardAllChecklistsCompletedTrigger } from './card/allChecklistsCompleted';
import { cardArchivedTrigger } from './card/archived';
import { cardCommentAddedTrigger } from './card/commentAdded';
import { boardMemberAddedTrigger } from './board/memberAdded';
import { listCardAddedTrigger } from './list/cardAdded';

// Register all card triggers.
registerTrigger(cardCreatedTrigger);
registerTrigger(cardMovedToListTrigger);
registerTrigger(cardMovedFromListTrigger);
registerTrigger(cardLabelAddedTrigger);
registerTrigger(cardLabelRemovedTrigger);
registerTrigger(cardMemberAddedTrigger);
registerTrigger(cardMemberRemovedTrigger);
registerTrigger(cardDueDateSetTrigger);
registerTrigger(cardDueDateRemovedTrigger);
registerTrigger(cardChecklistCompletedTrigger);
registerTrigger(cardAllChecklistsCompletedTrigger);
registerTrigger(cardArchivedTrigger);
registerTrigger(cardCommentAddedTrigger);

// Register board and list triggers.
registerTrigger(boardMemberAddedTrigger);
registerTrigger(listCardAddedTrigger);

// Re-export individual handlers for direct use and testing.
export {
  cardCreatedTrigger,
  cardMovedToListTrigger,
  cardMovedFromListTrigger,
  cardLabelAddedTrigger,
  cardLabelRemovedTrigger,
  cardMemberAddedTrigger,
  cardMemberRemovedTrigger,
  cardDueDateSetTrigger,
  cardDueDateRemovedTrigger,
  cardChecklistCompletedTrigger,
  cardAllChecklistsCompletedTrigger,
  cardArchivedTrigger,
  cardCommentAddedTrigger,
  boardMemberAddedTrigger,
  listCardAddedTrigger,
};

export { validateTrigger } from './validate';
