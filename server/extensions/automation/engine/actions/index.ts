// Action registry index — imports and registers all action handlers.
// Import this module once at server startup to populate the action registry.

import { registerAction } from '../registry';

import { listSortByDueDateAction } from './list/sortByDueDate';
import { listSortByNameAction } from './list/sortByName';
import { listArchiveAllCardsAction } from './list/archiveAllCards';
import { listMoveAllCardsAction } from './list/moveAllCards';

import { cardMoveToListAction } from './card/moveToList';
import { cardMoveToTopAction } from './card/moveToTop';
import { cardMoveToBottomAction } from './card/moveToBottom';
import { cardAddLabelAction } from './card/addLabel';
import { cardRemoveLabelAction } from './card/removeLabel';
import { cardAddMemberAction } from './card/addMember';
import { cardRemoveMemberAction } from './card/removeMember';
import { cardSetDueDateAction } from './card/setDueDate';
import { cardRemoveDueDateAction } from './card/removeDueDate';
import { cardMarkDueCompleteAction } from './card/markDueComplete';
import { cardAddCommentAction } from './card/addComment';
import { cardArchiveAction } from './card/archive';
import { cardAddChecklistAction } from './card/addChecklist';
import { cardMentionMembersAction } from './card/mentionMembers';

// Register all list actions.
registerAction(listSortByDueDateAction);
registerAction(listSortByNameAction);
registerAction(listArchiveAllCardsAction);
registerAction(listMoveAllCardsAction);

// Register all card actions.
registerAction(cardMoveToListAction);
registerAction(cardMoveToTopAction);
registerAction(cardMoveToBottomAction);
registerAction(cardAddLabelAction);
registerAction(cardRemoveLabelAction);
registerAction(cardAddMemberAction);
registerAction(cardRemoveMemberAction);
registerAction(cardSetDueDateAction);
registerAction(cardRemoveDueDateAction);
registerAction(cardMarkDueCompleteAction);
registerAction(cardAddCommentAction);
registerAction(cardArchiveAction);
registerAction(cardAddChecklistAction);
registerAction(cardMentionMembersAction);

// Re-export individual handlers for direct use and testing.
export {
  listSortByDueDateAction,
  listSortByNameAction,
  listArchiveAllCardsAction,
  listMoveAllCardsAction,
  cardMoveToListAction,
  cardMoveToTopAction,
  cardMoveToBottomAction,
  cardAddLabelAction,
  cardRemoveLabelAction,
  cardAddMemberAction,
  cardRemoveMemberAction,
  cardSetDueDateAction,
  cardRemoveDueDateAction,
  cardMarkDueCompleteAction,
  cardAddCommentAction,
  cardArchiveAction,
  cardAddChecklistAction,
  cardMentionMembersAction,
};

export { substituteVariables } from './variables';
