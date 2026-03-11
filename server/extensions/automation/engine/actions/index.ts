// Action registry index — imports and registers all action handlers.
// Import this module once at server startup to populate the action registry.

import { registerAction } from '../registry';

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
