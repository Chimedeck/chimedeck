// CardModal — full detail Radix Dialog modal for viewing and editing a card.
// URL-driven: ?card=:id opens the modal; closing clears the query param.
// Two-column layout: left = content, right = ActivityFeed (ResizablePanels).
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Card, Label, CardMember, Checklist } from '../api';
import CardTitle from './CardTitle';
import CardDescriptionTiptap from './CardDescriptionTiptap';
import CardChecklist from './CardChecklist';
import CardMetaStrip from './CardMetaStrip';
import CardModalBottomBar from './CardModalBottomBar';
import ResizablePanels from './ResizablePanels';
import ActivityFeed from '../containers/CardModal/ActivityFeed';
import CardDetailPluginBadges from '../../Plugins/uiInjections/CardDetailPluginBadges';
import CardPluginSection from '../../Plugins/uiInjections/CardPluginSection';
import CustomFieldsSection from '../../CustomFields/CustomFieldsSection';
import { AttachmentPanel } from '../../Attachments/components/AttachmentPanel';

import type { ActivityData } from '../slices/cardDetailSlice';
import type { CommentData } from '../api/cardDetail';

interface BoardMember {
  id: string;
  email: string;
  name: string | null;
}

interface Props {
  boardId: string;
  open: boolean;
  card: Card;
  listTitle: string;
  boardTitle: string;
  labels: Label[];
  allLabels: Label[];
  members: CardMember[];
  boardMembers: BoardMember[];
  checklists: Checklist[];
  comments: CommentData[];
  activities: ActivityData[];
  currentUserId: string;
  onClose: () => void;
  onTitleSave: (title: string) => void;
  onDescriptionSave: (description: string) => void;
  onStartDateChange: (date: string | null) => void;
  onDueDateChange: (date: string | null) => void;
  onDueCompleteChange: (done: boolean) => void;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onCopyLink: () => void;
  onCreateChecklist: (title?: string) => Promise<void>;
  onRenameChecklist: (checklistId: string, title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onItemAdd: (checklistId: string, title: string) => Promise<void>;
  onItemToggle: (checklistId: string, itemId: string, checked: boolean) => Promise<void>;
  onItemRename: (checklistId: string, itemId: string, title: string) => Promise<void>;
  onItemDelete: (checklistId: string, itemId: string) => Promise<void>;
  onLabelAttach: (labelId: string) => Promise<void>;
  onLabelDetach: (labelId: string) => Promise<void>;
  onLabelCreate: (name: string, color: string) => Promise<void>;
  onMemberAssign: (userId: string) => Promise<void>;
  onMemberRemove: (userId: string) => Promise<void>;
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onMoneySave: (amount: string | null, currency: string) => Promise<void>;
  /** True when the current user is a VIEWER guest — hides write-action controls. */
  isViewerGuest?: boolean;
}

const CardModal = ({
  boardId,
  open,
  card,
  listTitle,
  boardTitle,
  labels,
  allLabels,
  members,
  boardMembers,
  checklists,
  comments,
  activities,
  currentUserId,
  onClose,
  onTitleSave,
  onDescriptionSave,
  onStartDateChange,
  onDueDateChange,
  onDueCompleteChange,
  onArchive,
  onDelete,
  onCopyLink,
  onCreateChecklist,
  onRenameChecklist,
  onDeleteChecklist,
  onItemAdd,
  onItemToggle,
  onItemRename,
  onItemDelete,
  onLabelAttach,
  onLabelDetach,
  onLabelCreate,
  onMemberAssign,
  onMemberRemove,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onMoneySave,
  isViewerGuest = false,
}: Props) => {
  const isReadOnly = card.archived;
  // Activity panel visibility — toggled from the bottom bar
  const [activityVisible, setActivityVisible] = useState(true);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />

        {/* Panel */}
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 pb-8"
          aria-label={`Card: ${card.title}`}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          {/* Visually-hidden title for screen-reader accessibility (Radix requirement) */}
          <Dialog.Title className="sr-only">Card: {card.title}</Dialog.Title>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl mx-auto flex flex-col max-h-[calc(100vh-5rem)]">
            {/* Header */}
            <div className="flex items-start gap-2 p-5 pb-2">
              <div className="flex-1 min-w-0">
                <CardTitle
                  title={card.title}
                  onSave={onTitleSave}
                  disabled={isReadOnly}
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-slate-500 px-2">
                  in list <span className="text-gray-500 dark:text-slate-400 font-medium">{listTitle}</span>{' '}
                  · {boardTitle}
                </p>
              </div>
              <Dialog.Close
                className="rounded-lg p-2 text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Metadata strip — labels, members, dates */}
            <div className="px-5 pb-2">
              <CardMetaStrip
                labels={labels}
                allLabels={allLabels}
                members={members}
                boardMembers={boardMembers}
                cardId={card.id}
                currentUserId={currentUserId}
                amount={card.amount ?? null}
                currency={card.currency ?? null}
                startDate={card.start_date}
                dueDate={card.due_date}
                dueComplete={card.due_complete}
                disabled={isReadOnly}
                onLabelAttach={onLabelAttach}
                onLabelDetach={onLabelDetach}
                onLabelCreate={onLabelCreate}
                onMemberAssign={onMemberAssign}
                onMemberRemove={onMemberRemove}
                onMoneySave={onMoneySave}
                onStartDateChange={onStartDateChange}
                onDueDateChange={onDueDateChange}
                onDueCompleteChange={onDueCompleteChange}
              />
            </div>

            {isReadOnly && (
              <div className="mx-5 mb-2 rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-3 py-2 text-sm text-yellow-400">
                This card is archived.
              </div>
            )}

            {/* Body: ResizablePanels when activity visible, single column otherwise */}
            {activityVisible ? (
              <ResizablePanels
                className="flex-1 min-h-0"
                left={
                  <div className="h-full min-h-0 p-5 pt-3 pr-3 space-y-6">
                    <CardDescriptionTiptap
                      boardId={boardId}
                      cardId={card.id}
                      description={card.description ?? ''}
                      onSave={onDescriptionSave}
                      disabled={isReadOnly}
                    />

                    <CustomFieldsSection
                      boardId={boardId}
                      cardId={card.id}
                      disabled={isReadOnly}
                    />

                    <CardChecklist
                      checklists={checklists}
                      onCreateChecklist={onCreateChecklist}
                      onRenameChecklist={onRenameChecklist}
                      onDeleteChecklist={onDeleteChecklist}
                      onItemAdd={onItemAdd}
                      onItemToggle={onItemToggle}
                      onItemRename={onItemRename}
                      onItemDelete={onItemDelete}
                      disabled={isReadOnly}
                    />

                    <CardPluginSection
                      cardId={card.id}
                      listId={card.list_id}
                      boardId={boardId}
                    />

                    <AttachmentPanel cardId={card.id} canWrite={!isViewerGuest} />

                    {/* Plugin detail badges */}
                    <div className="flex flex-wrap gap-3">
                      <CardDetailPluginBadges
                        cardId={card.id}
                        listId={card.list_id}
                        boardId={boardId}
                        cardTitle={card.title}
                        listTitle={listTitle}
                        boardTitle={boardTitle}
                      />
                    </div>
                  </div>
                }
                right={
                  <div className="h-full min-h-0 p-5 pt-3 pl-3 border-l border-gray-100 dark:border-slate-800">
                    <ActivityFeed
                      boardId={boardId}
                      cardId={card.id}
                      comments={comments}
                      activities={activities}
                      currentUserId={currentUserId}
                      boardMembers={boardMembers}
                      onAddComment={onAddComment}
                      onEditComment={onEditComment}
                      onDeleteComment={onDeleteComment}
                      canAddComment={!isViewerGuest}
                    />
                  </div>
                }
              />
            ) : (
              <div className="flex-1 min-h-0 p-5 pt-3 overflow-y-auto">
                <div className="space-y-6">
                  <CardDescriptionTiptap
                    boardId={boardId}
                    cardId={card.id}
                    description={card.description ?? ''}
                    onSave={onDescriptionSave}
                    disabled={isReadOnly}
                  />

                  <CustomFieldsSection
                    boardId={boardId}
                    cardId={card.id}
                    disabled={isReadOnly}
                  />

                  <CardChecklist
                    checklists={checklists}
                    onCreateChecklist={onCreateChecklist}
                    onRenameChecklist={onRenameChecklist}
                    onDeleteChecklist={onDeleteChecklist}
                    onItemAdd={onItemAdd}
                    onItemToggle={onItemToggle}
                    onItemRename={onItemRename}
                    onItemDelete={onItemDelete}
                    disabled={isReadOnly}
                  />

                  <CardPluginSection
                    cardId={card.id}
                    listId={card.list_id}
                    boardId={boardId}
                  />

                  <AttachmentPanel cardId={card.id} canWrite={!isViewerGuest} />

                  {/* Plugin detail badges */}
                  <div className="flex flex-wrap gap-3">
                    <CardDetailPluginBadges
                      cardId={card.id}
                      listId={card.list_id}
                      boardId={boardId}
                      cardTitle={card.title}
                      listTitle={listTitle}
                      boardTitle={boardTitle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sticky bottom action bar */}
            <CardModalBottomBar
              boardId={boardId}
              cardId={card.id}
              listId={card.list_id}
              cardTitle={card.title}
              listTitle={listTitle}
              boardTitle={boardTitle}
              cardAmount={card.amount ?? null}
              cardCurrency={card.currency ?? null}
              archived={card.archived}
              disabled={isReadOnly}
              activityVisible={activityVisible}
              onToggleActivity={() => setActivityVisible((v) => !v)}
              onArchive={onArchive}
              onDelete={onDelete}
              onCopyLink={onCopyLink}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CardModal;
